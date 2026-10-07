import {
  Notification,
  NotificationAudience,
  NotificationType,
  OrderStatus,
  PaymentStatus,
} from '../entities';
import { OrdersService } from './orders.service';

// @nestjs/typeorm@12 is ESM-only while this repository's Jest runtime is
// CommonJS. OrdersService only needs these decorator shapes in this unit test.
jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

describe('OrdersService payment notifications', () => {
  function setup(status = OrderStatus.PENDING_PAYMENT) {
    const order = {
      id: 'order-1',
      orderNumber: 'QRB-2026-000001',
      buyerId: 'buyer-1',
      farmerId: 'farmer-1',
      status,
      paymentStatus: status === OrderStatus.PAID ? PaymentStatus.PAID : PaymentStatus.UNPAID,
    };
    const payment = { id: 'payment-1', orderId: order.id, status: PaymentStatus.UNPAID };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(order),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockResolvedValue(payment),
      save: jest.fn(async (value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
    };
    const reservationsService = { completeOrder: jest.fn() };
    const service = new OrdersService(
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      reservationsService as never,
    );
    return { manager, order, reservationsService, service };
  }

  it('notifies the farmer after payment is confirmed', async () => {
    const { manager, order, service } = setup();

    await service.completePaymentsFromProvider([order.id], 'chip-purchase-1', 'chip');

    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.PAYMENT,
        title: 'New paid order',
        relatedType: 'order',
        relatedId: order.id,
      }),
    );
  });

  it('does not duplicate the notification for an already-paid order', async () => {
    const { manager, order, service } = setup(OrderStatus.PAID);

    await service.completePaymentsFromProvider([order.id], 'chip-purchase-1', 'chip');

    expect(manager.create).not.toHaveBeenCalledWith(Notification, expect.anything());
  });
});
