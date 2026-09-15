import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  LessThanOrEqual,
  Like,
  Repository,
} from 'typeorm';
import {
  BulkListing,
  CartItem,
  DeliveryAddressSnapshot,
  DeliveryMethod,
  Livestock,
  Order,
  OrderItem,
  OrderItemType,
  OrderStatus,
  OrderTrackingEvent,
  PaymentStatus,
  RefundStatus,
  UserRole,
} from '../entities';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CartsService } from '../carts/carts.service';
import { LivestockService } from '../livestock/livestock.service';
import { BulkListingsService } from '../bulk-listings/bulk-listings.service';
import { reservationWindow } from '../livestock/listing-policy';

export interface CheckoutInput {
  deliveryMethod: DeliveryMethod;
  deliveryAddress: DeliveryAddressSnapshot;
  scheduledDate?: string;
  buyerNotes?: string;
}

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repository: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cartsService: CartsService,
    private readonly livestockService: LivestockService,
    private readonly bulkListingsService: BulkListingsService,
  ) {}

  findAllForBuyer(buyerId: string): Promise<Order[]> {
    return this.repository.find({
      where: { buyerId, hiddenFromBuyerHistory: false },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  findAllForFarmer(farmerId: string): Promise<Order[]> {
    return this.repository.find({
      where: { farmerId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  findAllForAdmin(): Promise<Order[]> {
    return this.repository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  findAllForActor(actor: AuthenticatedUser): Promise<Order[]> {
    if (actor.role === UserRole.ADMIN) return this.findAllForAdmin();
    if (actor.role === UserRole.FARMER) return this.findAllForFarmer(actor.sub);
    return this.findAllForBuyer(actor.sub);
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.repository.findOne({
      where: { id },
      relations: { items: true, trackingEvents: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async findOneForActor(id: string, actor: AuthenticatedUser): Promise<Order> {
    const order = await this.findOne(id);
    if (
      actor.role !== UserRole.ADMIN &&
      order.buyerId !== actor.sub &&
      order.farmerId !== actor.sub
    ) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async assertBuyerOwns(id: string, buyerId: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.buyerId !== buyerId)
      throw new NotFoundException(`Order ${id} not found`);
  }

  async assertFarmerOwns(id: string, farmerId: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.farmerId !== farmerId)
      throw new NotFoundException(`Order ${id} not found`);
  }

  // Buyer's cart -> one or more orders, split per farmer (an order always
  // belongs to exactly one farmer). Each farmer's order is created in its own
  // transaction: prices are snapshotted onto order_items, bulk shares are
  // reserved under a row lock, the source livestock is marked sold, and the
  // consumed cart items are removed — all atomically, so a failure for one
  // farmer's group never touches another's.
  async checkout(buyerId: string, input: CheckoutInput): Promise<Order[]> {
    const cart = await this.cartsService.getCartWithItemsForUser(buyerId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const groups = new Map<string, CartItem[]>();
    for (const item of cart.items) {
      const farmerId =
        item.itemType === OrderItemType.LIVESTOCK
          ? item.livestock?.farmerId
          : item.bulkListing?.farmerId;
      if (!farmerId) {
        throw new BadRequestException(
          `Cart item ${item.id} points at a listing that no longer exists`,
        );
      }
      const group = groups.get(farmerId) ?? [];
      group.push(item);
      groups.set(farmerId, group);
    }

    const orders: Order[] = [];
    for (const [farmerId, items] of groups) {
      orders.push(
        await this.createOrderForFarmer(buyerId, farmerId, items, input),
      );
    }
    return orders;
  }

  private async createOrderForFarmer(
    buyerId: string,
    farmerId: string,
    items: CartItem[],
    input: CheckoutInput,
  ): Promise<Order> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          let subtotal = 0;
          const itemsToInsert: DeepPartial<OrderItem>[] = [];

          for (const item of items) {
            const isLivestock = item.itemType === OrderItemType.LIVESTOCK;
            const unitPrice = isLivestock
              ? (item.livestock as Livestock).price
              : (item.bulkListing as BulkListing).pricePerShare;
            const title = isLivestock
              ? (item.livestock as Livestock).title
              : (item.bulkListing as BulkListing).title;
            const images = isLivestock
              ? (item.livestock as Livestock).images
              : (item.bulkListing as BulkListing).images;
            const lineTotal = Number(unitPrice) * item.quantity;
            subtotal += lineTotal;

            itemsToInsert.push({
              itemType: item.itemType,
              livestockId: item.livestockId,
              bulkListingId: item.bulkListingId,
              titleSnapshot: title,
              imageSnapshot: images?.[0] ?? null,
              unitPrice,
              quantity: item.quantity,
              lineTotal: lineTotal.toFixed(2),
              metadata: item.metadata,
            });
          }

          const { reservationStartedAt, reservationExpiresAt } =
            reservationWindow();
          const order = await manager.save(
            manager.create(Order, {
              orderNumber: await this.generateOrderNumber(manager),
              buyerId,
              farmerId,
              status: OrderStatus.PENDING_PAYMENT,
              subtotal: subtotal.toFixed(2),
              deliveryFee: '0.00',
              discount: '0.00',
              total: subtotal.toFixed(2),
              currency: 'MYR',
              paymentStatus: PaymentStatus.UNPAID,
              reservationActive: items.some(
                (item) => item.itemType === OrderItemType.LIVESTOCK,
              ),
              reservationStartedAt,
              reservationExpiresAt,
              deliveryMethod: input.deliveryMethod,
              deliveryAddress: input.deliveryAddress,
              scheduledDate: input.scheduledDate ?? null,
              buyerNotes: input.buyerNotes ?? null,
            }),
          );

          for (const item of items) {
            if (item.itemType === OrderItemType.LIVESTOCK) {
              const lockedListing = await this.livestockService.reserveForOrder(
                item.livestockId as string,
                order.id,
                buyerId,
                reservationExpiresAt,
                manager,
              );
              if (
                String(lockedListing.price) !== String(item.livestock?.price)
              ) {
                throw new BadRequestException(
                  'A livestock price changed. Refresh the cart before checkout.',
                );
              }
            } else {
              await this.bulkListingsService.reserveShares(
                item.bulkListingId as string,
                item.quantity,
                manager,
              );
            }
          }

          for (const data of itemsToInsert) {
            await manager.save(
              manager.create(OrderItem, { ...data, orderId: order.id }),
            );
          }

          await manager.save(
            manager.create(OrderTrackingEvent, {
              orderId: order.id,
              status: OrderStatus.PENDING_PAYMENT,
              note: 'Order created',
            }),
          );

          await manager.delete(
            CartItem,
            items.map((item) => item.id),
          );

          return order;
        });
      } catch (err) {
        if (isDuplicateOrderNumberError(err)) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  // Approximate sequential numbering: good enough for a human-readable
  // reference, with the unique index + retry loop in createOrderForFarmer
  // as the real correctness guarantee under concurrent checkouts.
  private async generateOrderNumber(manager: EntityManager): Promise<string> {
    const prefix = `QRB-${new Date().getFullYear()}-`;
    const count = await manager.count(Order, {
      where: { orderNumber: Like(`${prefix}%`) },
    });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  // Every status transition appends a tracking event in the same
  // transaction — order_tracking_events is append-only, so this is the only
  // way order.status should ever change.
  async updateStatus(
    id: string,
    status: OrderStatus,
    opts: {
      note?: string;
      images?: string[];
      location?: string;
      userId?: string;
      extra?: DeepPartial<Order>;
    } = {},
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException(`Order ${id} not found`);

      Object.assign(order, opts.extra ?? {}, { status });
      if (status === OrderStatus.DELIVERED) order.deliveredAt = new Date();
      if (status === OrderStatus.RECEIVED) order.receivedAt = new Date();
      if (status === OrderStatus.CANCELLED) {
        order.cancelledAt = new Date();
        order.reservationActive = false;
        await this.livestockService.releaseOrderReservations(id, manager);
      }
      await manager.save(order);

      await manager.save(
        manager.create(OrderTrackingEvent, {
          orderId: id,
          status,
          note: opts.note ?? null,
          images: opts.images ?? null,
          location: opts.location ?? null,
          createdByUserId: opts.userId ?? null,
        }),
      );

      return order;
    });
  }

  async cancel(id: string, reason: string, userId?: string): Promise<Order> {
    return this.updateStatus(id, OrderStatus.CANCELLED, {
      note: reason,
      userId,
      extra: { cancellationReason: reason },
    });
  }

  async markReceived(
    id: string,
    proofImages: string[],
    userId?: string,
  ): Promise<Order> {
    return this.updateStatus(id, OrderStatus.RECEIVED, {
      images: proofImages,
      userId,
      extra: { receivedProofImages: proofImages },
    });
  }

  async requestRefund(id: string, reason: string): Promise<Order> {
    return this.updateStatus(id, OrderStatus.REFUND_REQUESTED, {
      note: reason,
      extra: {
        refundStatus: RefundStatus.REQUESTED,
        refundReason: reason,
        refundRequestedAt: new Date(),
      },
    });
  }

  // Only touches the refund fields — whether/when order.status itself moves
  // to REFUNDED is a separate, explicit call once the refund is processed.
  async reviewRefund(
    id: string,
    input: { approve: boolean; reviewedByUserId: string; note?: string },
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.refundStatus = input.approve
      ? RefundStatus.APPROVED
      : RefundStatus.REJECTED;
    order.refundReviewedByUserId = input.reviewedByUserId;
    order.refundReviewedAt = new Date();
    if (input.note) order.refundReason = input.note;
    return this.repository.save(order);
  }

  async hideFromBuyerHistory(id: string, hidden: boolean): Promise<Order> {
    await this.repository.update(id, { hiddenFromBuyerHistory: hidden });
    return this.findOne(id);
  }

  async confirmPayment(id: string, paymentReference: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(`Order ${id} not found`);
      if (order.paymentStatus === PaymentStatus.PAID) return order;
      if (
        order.status !== OrderStatus.PENDING_PAYMENT ||
        (order.reservationActive &&
          order.reservationExpiresAt &&
          order.reservationExpiresAt <= new Date())
      ) {
        throw new BadRequestException(
          'The payment reservation is no longer valid',
        );
      }

      await this.livestockService.finalizeOrderReservations(id, manager);
      order.status = OrderStatus.PAID;
      order.paymentStatus = PaymentStatus.PAID;
      order.paymentReference = paymentReference;
      order.paidAt = new Date();
      order.reservationActive = false;
      await manager.save(order);
      await manager.save(
        manager.create(OrderTrackingEvent, {
          orderId: id,
          status: OrderStatus.PAID,
          note: 'Payment confirmed',
        }),
      );
      return order;
    });
  }

  async expirePendingReservations(now = new Date()): Promise<number> {
    const expired = await this.repository.find({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        reservationActive: true,
        reservationExpiresAt: LessThanOrEqual(now),
      },
    });
    for (const order of expired) {
      await this.cancel(order.id, 'The 24-hour payment window expired');
    }
    return expired.length;
  }
}

function isDuplicateOrderNumberError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}
