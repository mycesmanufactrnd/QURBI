import { ForbiddenException } from '@nestjs/common';
import {
  DeliveryMethod,
  Order,
  OrderStatus,
  RefundStatus,
  UserRole,
} from '../entities';
import { OrdersService } from './orders.service';

// @nestjs/typeorm@12 is ESM-only while this repository's Jest runtime is
// CommonJS.
jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

function setup(orderOverrides: Partial<Order> = {}, assignments = 0) {
  const order = {
    id: 'order-1',
    orderNumber: 'QRB-1',
    buyerId: 'buyer-1',
    farmerId: 'farmer-1',
    status: OrderStatus.PAID,
    deliveryMethod: DeliveryMethod.DELIVERY,
    refundStatus: RefundStatus.NONE,
    readyForPickupAt: null,
    ...orderOverrides,
  } as unknown as Order;
  const manager = {
    findOne: jest.fn(async () => order),
    count: jest.fn(async () => assignments),
    save: jest.fn(async (value: unknown) => value),
    create: jest.fn((_entity: unknown, value: unknown) => value),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const service = new OrdersService(
    {} as never,
    dataSource as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const applyStatusChange = jest
    .spyOn(service, 'applyStatusChange')
    .mockImplementation(async (_m, o, status) => {
      o.status = status;
      return o;
    });
  return { service, order, manager, applyStatusChange };
}

const farmer = { id: 'farmer-1', role: UserRole.FARMER };
const admin = { id: 'admin-1', role: UserRole.ADMIN };

describe('farmer fulfilment on courier orders', () => {
  it('still lets the farmer take the preparing photo', async () => {
    const { service, applyStatusChange } = setup();
    await service.advanceStatus('order-1', farmer, OrderStatus.PREPARING, {
      images: ['/uploads/private/x'],
    });
    expect(applyStatusChange).toHaveBeenCalled();
  });

  it('stops the farmer dispatching a delivery order', async () => {
    const { service, applyStatusChange } = setup({ status: OrderStatus.PREPARING });
    await expect(
      service.advanceStatus('order-1', farmer, OrderStatus.IN_TRANSIT),
    ).rejects.toThrow(/courier dispatches/);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('stops the farmer marking delivered once a courier was ever assigned', async () => {
    const { service } = setup({ status: OrderStatus.IN_TRANSIT }, 1);
    await expect(
      service.advanceStatus('order-1', farmer, OrderStatus.DELIVERED),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the farmer finish a legacy order already in transit without any assignment', async () => {
    const { service, applyStatusChange } = setup({ status: OrderStatus.IN_TRANSIT }, 0);
    await service.advanceStatus('order-1', farmer, OrderStatus.DELIVERED, {
      images: ['/uploads/private/x'],
    });
    expect(applyStatusChange).toHaveBeenCalled();
  });

  it('does not restrict pickup and slaughter-at-farm orders', async () => {
    const { service, applyStatusChange } = setup({
      status: OrderStatus.PREPARING,
      deliveryMethod: DeliveryMethod.SELF_PICKUP,
    });
    await service.advanceStatus('order-1', farmer, OrderStatus.IN_TRANSIT);
    expect(applyStatusChange).toHaveBeenCalled();
  });

  it('does not restrict an admin', async () => {
    const { service, applyStatusChange } = setup({ status: OrderStatus.PREPARING });
    await service.advanceStatus('order-1', admin, OrderStatus.IN_TRANSIT);
    expect(applyStatusChange).toHaveBeenCalled();
  });
});

describe('markReadyForPickup', () => {
  it('moves a paid order to preparing and releases it to the pool', async () => {
    const { service, order, applyStatusChange } = setup();
    await service.markReadyForPickup('order-1', farmer);
    expect(applyStatusChange).toHaveBeenCalledWith(
      expect.anything(),
      order,
      OrderStatus.PREPARING,
      expect.objectContaining({ userId: 'farmer-1' }),
    );
    expect(order.readyForPickupAt).toBeInstanceOf(Date);
  });

  it('only releases a preparing order without an extra status change', async () => {
    const { service, order, applyStatusChange } = setup({
      status: OrderStatus.PREPARING,
    });
    await service.markReadyForPickup('order-1', farmer);
    expect(applyStatusChange).not.toHaveBeenCalled();
    expect(order.readyForPickupAt).toBeInstanceOf(Date);
  });

  it('is a no-op when already released', async () => {
    const readyAt = new Date('2026-10-01T00:00:00Z');
    const { service, order, manager } = setup({
      status: OrderStatus.PREPARING,
      readyForPickupAt: readyAt,
    });
    await service.markReadyForPickup('order-1', farmer);
    expect(order.readyForPickupAt).toBe(readyAt);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses pickup-at-farm orders, unpaid orders and refund disputes', async () => {
    await expect(
      setup({ deliveryMethod: DeliveryMethod.SELF_PICKUP }).service.markReadyForPickup(
        'order-1',
        farmer,
      ),
    ).rejects.toThrow(/Only delivery orders/);
    await expect(
      setup({ status: OrderStatus.PENDING_PAYMENT }).service.markReadyForPickup(
        'order-1',
        farmer,
      ),
    ).rejects.toThrow(/cannot be released/);
    await expect(
      setup({ refundStatus: RefundStatus.REQUESTED }).service.markReadyForPickup(
        'order-1',
        farmer,
      ),
    ).rejects.toThrow(/refund/);
  });

  it("will not release another farmer's order", async () => {
    const { service } = setup();
    await expect(
      service.markReadyForPickup('order-1', { id: 'farmer-2', role: UserRole.FARMER }),
    ).rejects.toThrow(/not found/);
  });

  it('never lets a buyer or courier release an order', async () => {
    const { service } = setup();
    await expect(
      service.markReadyForPickup('order-1', { id: 'buyer-1', role: UserRole.BUYER }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.markReadyForPickup('order-1', { id: 'c', role: UserRole.COURIER }),
    ).rejects.toThrow(ForbiddenException);
  });
});
