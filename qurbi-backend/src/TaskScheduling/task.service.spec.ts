import {
  LivestockStatus,
  Notification,
  NotificationAudience,
  NotificationType,
} from '../entities';
import { TasksService } from './task.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
}));

describe('TasksService listing expiry notifications', () => {
  it('notifies the farmer once when an available listing expires', async () => {
    const listing = {
      id: 'livestock-1',
      farmerId: 'farmer-1',
      status: LivestockStatus.AVAILABLE,
      attributes: { species: 'Goat', breed: 'Boer' },
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValueOnce([listing])
        .mockResolvedValueOnce([]),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const service = new TasksService(dataSource as never, {} as never);

    await service.expireLivestockListings();
    await service.expireLivestockListings();

    expect(listing.status).toBe(LivestockStatus.UNAVAILABLE);
    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: listing.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.LISTING,
        title: 'Listing expired',
        relatedId: listing.id,
      }),
    );
    const notificationCalls = manager.create.mock.calls.filter(
      ([entity]) => entity === Notification,
    );
    expect(notificationCalls).toHaveLength(1);
  });
});
