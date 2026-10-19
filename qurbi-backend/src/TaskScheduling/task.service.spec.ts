import { TasksService } from './task.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

describe('TasksService listing expiry scheduling', () => {
  it('runs centralized listing expiry logic inside a transaction', async () => {
    const manager = { id: 'transaction-manager' };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    };
    const livestockService = {
      expireDueListings: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TasksService(
      dataSource as never,
      {} as never,
      livestockService as never,
    );

    await service.expireLivestockListings();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(livestockService.expireDueListings).toHaveBeenCalledWith(manager);
  });
});
