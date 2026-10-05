import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  Payment,
  PaymentSession,
  PaymentSessionOrder,
  PaymentStatus,
  User,
} from '../entities';
import { OrdersService } from '../orders/orders.service';
import { ReservationsService } from '../reservations/reservations.service';
import { ChipClient } from './providers/chip/chip.client';
import { ChipSignatureService } from './providers/chip/chip-signature.service';
import type { ChipPurchase } from './providers/chip/chip.types';

const FAILED_CHIP_STATUSES = new Set(['cancelled', 'failed', 'error']);

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentSession)
    private readonly sessions: Repository<PaymentSession>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly reservationsService: ReservationsService,
    private readonly chipClient: ChipClient,
    private readonly chipSignature: ChipSignatureService,
    private readonly config: ConfigService,
  ) {}

  async createChipCheckout(buyerId: string, requestedOrderIds: string[]) {
    const orderIds = [...new Set(requestedOrderIds)].sort();
    if (!orderIds.length) throw new BadRequestException('At least one order is required');

    const prepared = await this.dataSource.transaction(async (manager) => {
      await this.reservationsService.expireDue(manager);
      const orders = await manager.find(Order, {
        where: { id: In(orderIds) },
        relations: { items: true, buyer: true, reservations: true },
        order: { createdAt: 'ASC' },
      });
      if (orders.length !== orderIds.length) throw new NotFoundException('One or more orders were not found');
      if (orders.some((order) => order.buyerId !== buyerId)) {
        throw new ForbiddenException('You can only pay for your own orders');
      }
      if (orders.some((order) => order.status !== OrderStatus.PENDING_PAYMENT)) {
        throw new ConflictException('One or more orders are no longer awaiting payment');
      }
      if (orders.some((order) => order.currency !== 'MYR')) {
        throw new BadRequestException('CHIP checkout currently supports MYR orders only');
      }

      const reusable = await manager.find(PaymentSession, {
        where: { buyerId, provider: 'chip', status: PaymentStatus.UNPAID },
        relations: { orderLinks: true },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      const existing = reusable.find((session) =>
        Boolean(session.checkoutUrl) &&
        (!session.expiresAt || session.expiresAt > new Date()) &&
        sameIds(session.orderLinks.map((link) => link.orderId), orderIds),
      );
      if (existing) return { session: existing, orders, existing: true };

      const totalCents = orders.reduce((sum, order) => sum + moneyToCents(order.total), 0);
      if (totalCents <= 0) throw new BadRequestException('Payment amount must be greater than zero');
      const expiryMinutes = positiveInteger(
        this.config.get<string>('CHIP_PAYMENT_EXPIRY_MINUTES'),
        60,
      );
      const expiresAt = new Date(Date.now() + expiryMinutes * 60_000);
      const session = await manager.save(manager.create(PaymentSession, {
        buyerId,
        provider: 'chip',
        status: PaymentStatus.UNPAID,
        providerStatus: 'creating',
        amount: centsToMoney(totalCents),
        currency: 'MYR',
        expiresAt,
        isTest: (this.config.get<string>('CHIP_MODE') || 'test').toLowerCase() !== 'live',
      }));
      await manager.save(orderIds.map((orderId) => manager.create(PaymentSessionOrder, {
        paymentSessionId: session.id,
        orderId,
      })));
      return { session, orders, existing: false };
    });

    if (prepared.existing) return checkoutResponse(prepared.session, orderIds);

    const { session, orders } = prepared;
    try {
      const buyer = orders[0].buyer as User;
      const providerPurchase = await this.chipClient.createPurchase({
        brand_id: this.config.getOrThrow<string>('CHIP_BRAND_ID'),
        reference: `QURBI-${session.id}`,
        client: {
          email: buyer.email,
          full_name: buyer.fullName,
          phone: buyer.phone || orders[0].deliveryAddress?.recipientPhone || undefined,
        },
        purchase: {
          currency: 'MYR',
          products: orders.map((order) => ({
            name: `QURBI order ${order.orderNumber}`,
            price: moneyToCents(order.total),
            quantity: 1,
          })),
          metadata: {
            qurbi_payment_session_id: session.id,
            qurbi_order_ids: orderIds,
          },
        },
        success_redirect: returnUrl(this.config, 'CHIP_SUCCESS_REDIRECT_URL', session.id, orderIds),
        failure_redirect: returnUrl(this.config, 'CHIP_FAILURE_REDIRECT_URL', session.id, orderIds),
        cancel_redirect: returnUrl(this.config, 'CHIP_CANCEL_REDIRECT_URL', session.id, orderIds),
        success_callback: requiredHttpsUrl(this.config, 'CHIP_WEBHOOK_URL'),
      });
      if (!providerPurchase.id || !providerPurchase.checkout_url) {
        throw new BadRequestException('CHIP did not return a checkout URL');
      }

      await this.dataSource.transaction(async (manager) => {
        session.providerReference = providerPurchase.id;
        session.providerStatus = providerPurchase.status;
        session.checkoutUrl = providerPurchase.checkout_url;
        session.isTest = providerPurchase.is_test;
        await manager.save(session);
        await manager.update(Payment, { orderId: In(orderIds) }, {
          provider: 'chip',
          providerReference: providerPurchase.id,
          status: PaymentStatus.UNPAID,
        });
        await manager.update(Order, { id: In(orderIds) }, {
          paymentMethod: 'chip',
          paymentReference: providerPurchase.id,
          paymentStatus: PaymentStatus.UNPAID,
        });
      });
      return checkoutResponse(session, orderIds);
    } catch (error) {
      await this.sessions.update(session.id, {
        status: PaymentStatus.FAILED,
        providerStatus: 'create_failed',
        failureMessage: safeErrorMessage(error),
      });
      throw error;
    }
  }

  async getSessionForBuyer(id: string, buyerId: string) {
    const session = await this.sessions.findOne({
      where: { id },
      relations: { orderLinks: true },
    });
    if (!session) throw new NotFoundException('Payment session not found');
    if (session.buyerId !== buyerId) throw new ForbiddenException('This payment session belongs to another buyer');
    return sessionResponse(session);
  }

  async handleChipWebhook(rawBody: Buffer | undefined, signature: string | undefined, payload: ChipPurchase) {
    this.chipSignature.verify(rawBody, signature);
    if (!payload?.id) throw new BadRequestException('Invalid CHIP webhook payload');

    const session = await this.sessions.findOne({
      where: { provider: 'chip', providerReference: payload.id },
      relations: { orderLinks: true },
    });
    // A valid CHIP event can belong to another Brand/integration. Acknowledge it
    // so CHIP does not retry an event that QURBI intentionally does not own.
    if (!session) return { received: true, ignored: true };

    if (payload.event_type === 'purchase.paid' || payload.status === 'paid') {
      const purchase = await this.chipClient.retrievePurchase(payload.id);
      this.assertPurchaseMatches(session, purchase);
      const orderIds = session.orderLinks.map((link) => link.orderId).sort();
      await this.ordersService.completePaymentsFromProvider(orderIds, purchase.id, 'chip');
      const paidAt = new Date();
      await this.sessions.update(session.id, {
        status: PaymentStatus.PAID,
        providerStatus: purchase.status,
        paidAt,
        failureMessage: null,
      });
      return { received: true, status: PaymentStatus.PAID };
    }

    if (payload.event_type === 'purchase.payment_failure' || FAILED_CHIP_STATUSES.has(payload.status)) {
      const orderIds = session.orderLinks.map((link) => link.orderId);
      await this.ordersService.markPaymentsFailedFromProvider(orderIds, payload.id, 'chip');
      await this.sessions.update(session.id, {
        status: PaymentStatus.FAILED,
        providerStatus: payload.status || 'failed',
        failureMessage: 'Payment was not completed by CHIP',
      });
      return { received: true, status: PaymentStatus.FAILED };
    }

    await this.sessions.update(session.id, { providerStatus: payload.status || session.providerStatus });
    return { received: true, status: session.status };
  }

  private assertPurchaseMatches(session: PaymentSession, purchase: ChipPurchase): void {
    if (purchase.status !== 'paid') throw new ConflictException('CHIP purchase is not paid');
    if (purchase.purchase?.currency !== session.currency) {
      throw new ConflictException('CHIP payment currency does not match the order');
    }
    if (purchase.purchase?.total !== moneyToCents(session.amount)) {
      throw new ConflictException('CHIP payment amount does not match the order');
    }
    if (session.isTest !== Boolean(purchase.is_test)) {
      throw new ConflictException('CHIP payment environment does not match this session');
    }
  }
}

function moneyToCents(value: string | number): number {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new BadRequestException('Invalid order amount');
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function centsToMoney(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((id, index) => id === [...right].sort()[index]);
}

function returnUrl(config: ConfigService, key: string, sessionId: string, orderIds: string[]): string {
  const configured = config.get<string>(key)?.trim();
  if (!configured) throw new BadRequestException(`${key} is not configured`);
  const url = new URL(configured);
  url.searchParams.set('payment_session_id', sessionId);
  url.searchParams.set('order_ids', orderIds.join(','));
  return url.toString();
}

function requiredHttpsUrl(config: ConfigService, key: string): string {
  const configured = config.get<string>(key)?.trim();
  if (!configured) throw new BadRequestException(`${key} is not configured`);
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.port) {
    throw new BadRequestException(`${key} must use HTTPS without an explicit port`);
  }
  return url.toString();
}

function checkoutResponse(session: PaymentSession, orderIds: string[]) {
  return {
    paymentSessionId: session.id,
    orderIds,
    status: session.status,
    checkoutUrl: session.checkoutUrl,
    expiresAt: session.expiresAt,
    isTest: session.isTest,
  };
}

function sessionResponse(session: PaymentSession) {
  return {
    paymentSessionId: session.id,
    orderIds: session.orderLinks.map((link) => link.orderId),
    status: session.status,
    providerStatus: session.providerStatus,
    amount: session.amount,
    currency: session.currency,
    expiresAt: session.expiresAt,
    paidAt: session.paidAt,
    failureMessage: session.failureMessage,
    isTest: session.isTest,
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Unable to create CHIP payment';
}
