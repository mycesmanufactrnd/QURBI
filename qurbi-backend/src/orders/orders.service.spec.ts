import {
  Notification,
  NotificationAudience,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  UserRole,
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
      paymentStatus:
        status === OrderStatus.PAID ? PaymentStatus.PAID : PaymentStatus.UNPAID,
    };
    const payment = {
      id: 'payment-1',
      orderId: order.id,
      status: PaymentStatus.UNPAID,
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(order),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockResolvedValue(payment),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
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

    await service.completePaymentsFromProvider(
      [order.id],
      'chip-purchase-1',
      'chip',
    );

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

    await service.completePaymentsFromProvider(
      [order.id],
      'chip-purchase-1',
      'chip',
    );

    expect(manager.create).not.toHaveBeenCalledWith(
      Notification,
      expect.anything(),
    );
  });
});

describe('OrdersService received notifications', () => {
  function setup() {
    const order = {
      id: 'order-1',
      orderNumber: 'QRB-2026-000001',
      buyerId: 'buyer-1',
      farmerId: 'farmer-1',
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
    };
    const manager = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(order)),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const service = new OrdersService(
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { manager, order, service };
  }

  it('notifies the farmer when the buyer confirms receipt', async () => {
    const { manager, order, service } = setup();

    await service.markReceived(
      order.id,
      { id: order.buyerId, role: UserRole.BUYER },
      ['/uploads/private/received-proof.jpg'],
    );

    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.ORDER_UPDATE,
        title: 'Order received by buyer',
        linkUrl: `/orders/${order.id}`,
        relatedType: 'order',
        relatedId: order.id,
      }),
    );
  });

  it('does not create a second notification after the order is received', async () => {
    const { manager, order, service } = setup();
    const actor = { id: order.buyerId, role: UserRole.BUYER };

    await service.markReceived(order.id, actor, []);
    await expect(service.markReceived(order.id, actor, [])).rejects.toThrow(
      'cannot move from received to received',
    );

    const notificationCalls = manager.create.mock.calls.filter(
      ([entity]) => entity === Notification,
    );
    expect(notificationCalls).toHaveLength(1);
  });
});

describe('OrdersService refund notifications', () => {
  function setup(refundStatus = RefundStatus.NONE) {
    const order = {
      id: 'order-1',
      orderNumber: 'QRB-2026-000001',
      buyerId: 'buyer-1',
      farmerId: 'farmer-1',
      status: OrderStatus.RECEIVED,
      refundStatus,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const service = new OrdersService(
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { manager, order, service };
  }

  it('notifies the farmer when the buyer requests a refund', async () => {
    const { manager, order, service } = setup();

    await service.requestRefund(
      order.id,
      { id: order.buyerId, role: UserRole.BUYER },
      'Animal condition differs from the listing',
    );

    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        title: 'Refund requested',
        relatedId: order.id,
      }),
    );
  });

  it('notifies both parties when an admin rejects a refund', async () => {
    const { manager, order, service } = setup(RefundStatus.REQUESTED);

    await service.reviewRefund(
      order.id,
      { id: 'admin-1', role: UserRole.ADMIN },
      { approve: false, note: 'Evidence is insufficient' },
    );

    const notificationValues = manager.create.mock.calls
      .filter(([entity]) => entity === Notification)
      .map(([, value]) => value);
    expect(notificationValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: order.buyerId,
          audience: NotificationAudience.BUYER,
          title: 'Refund rejected',
        }),
        expect.objectContaining({
          userId: order.farmerId,
          audience: NotificationAudience.FARMER,
          title: 'Refund rejected',
        }),
      ]),
    );
  });
});

describe('OrdersService cancellation notifications', () => {
  it('notifies the buyer when the farmer cancels an order', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'QRB-2026-000001',
      buyerId: 'buyer-1',
      farmerId: 'farmer-1',
      status: OrderStatus.PAID,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const reservationsService = { cancelOrder: jest.fn() };
    const service = new OrdersService(
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      reservationsService as never,
    );

    await service.cancel(
      order.id,
      { id: order.farmerId, role: UserRole.FARMER },
      'Livestock is no longer available',
    );

    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: order.buyerId,
        audience: NotificationAudience.BUYER,
        title: 'Order cancelled',
        relatedId: order.id,
      }),
    );
  });
});
