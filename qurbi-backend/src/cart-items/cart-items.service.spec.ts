import { BadRequestException } from '@nestjs/common';
import { OrderItemType } from '../entities';
import { CartItemsService } from './cart-items.service';

// @nestjs/typeorm@12 is ESM-only while this repository's Jest runtime is
// CommonJS. This service only needs the decorator shape in these unit tests.
jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

describe('CartItemsService unique listing quantities', () => {
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
  };
  const cartsService = {
    getOrCreateForUser: jest.fn(async () => ({ id: 'cart-1' })),
  };
  const reservationsService = {
    availability: jest.fn(async () => ({ available: true, state: 'available' })),
  };
  const service = new CartItemsService(
    repository as never,
    cartsService as never,
    reservationsService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects a livestock quantity greater than one', async () => {
    await expect(service.addItem({
      userId: 'buyer-1',
      itemType: OrderItemType.LIVESTOCK,
      livestockId: 'livestock-1',
      quantity: 20,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(reservationsService.availability).not.toHaveBeenCalled();
  });

  it('normalises a legacy cart quantity instead of incrementing it', async () => {
    const legacy = {
      id: 'item-1',
      cartId: 'cart-1',
      itemType: OrderItemType.LIVESTOCK,
      livestockId: 'livestock-1',
      bulkListingId: null,
      quantity: 20,
    };
    repository.findOne.mockResolvedValueOnce(legacy);

    const result = await service.addItem({
      userId: 'buyer-1',
      itemType: OrderItemType.LIVESTOCK,
      livestockId: 'livestock-1',
      quantity: 1,
    });

    expect(result.quantity).toBe(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
  });

  it('rejects quantity updates for unique listings', async () => {
    repository.findOne.mockResolvedValueOnce({
      id: 'item-1',
      cartId: 'cart-1',
      itemType: OrderItemType.LIVESTOCK,
      quantity: 1,
    });

    await expect(service.updateQuantity('buyer-1', 'item-1', 2))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
