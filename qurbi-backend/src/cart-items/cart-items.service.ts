import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CartItem, OrderItemType } from '../entities';
import { CartsService } from '../carts/carts.service';

type AddCartItemInput = {
  userId: string;
  itemType: OrderItemType;
  livestockId?: string;
  bulkListingId?: string;
  quantity: number;
  metadata?: Record<string, any>;
};

@Injectable()
export class CartItemsService {
  constructor(
    @InjectRepository(CartItem) private readonly repository: Repository<CartItem>,
    private readonly cartsService: CartsService,
  ) {}

  async findAllForUser(userId: string): Promise<CartItem[]> {
    const cart = await this.cartsService.getOrCreateForUser(userId);
    return this.repository.find({
      where: { cartId: cart.id },
      relations: { livestock: true, bulkListing: true },
    });
  }

  // No price snapshot here on purpose — the cart shows live prices;
  // snapshotting happens once at checkout, on order_items.
  async addItem(input: AddCartItemInput): Promise<CartItem> {
    this.assertValidTarget(input);
    const cart = await this.cartsService.getOrCreateForUser(input.userId);

    // TypeORM throws on both `undefined` and a bare `null` inside a where
    // clause — the unset FK (exactly one of the two, per assertValidTarget)
    // must use IsNull() to mean "IS NULL".
    const existing = await this.repository.findOne({
      where: {
        cartId: cart.id,
        itemType: input.itemType,
        livestockId: input.livestockId ?? IsNull(),
        bulkListingId: input.bulkListingId ?? IsNull(),
      },
    });
    if (existing) {
      existing.quantity += input.quantity;
      return this.repository.save(existing);
    }

    return this.repository.save(
      this.repository.create({
        cartId: cart.id,
        itemType: input.itemType,
        livestockId: input.livestockId ?? null,
        bulkListingId: input.bulkListingId ?? null,
        quantity: input.quantity,
        metadata: input.metadata ?? null,
      }),
    );
  }

  async updateQuantity(userId: string, itemId: string, quantity: number): Promise<CartItem> {
    const item = await this.findOwnedItem(userId, itemId);
    item.quantity = quantity;
    return this.repository.save(item);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.findOwnedItem(userId, itemId);
    await this.repository.remove(item);
  }

  private async findOwnedItem(userId: string, itemId: string): Promise<CartItem> {
    const cart = await this.cartsService.getOrCreateForUser(userId);
    const item = await this.repository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`CartItem ${itemId} not found`);
    if (item.cartId !== cart.id) {
      throw new ForbiddenException(`CartItem ${itemId} does not belong to this user's cart`);
    }
    return item;
  }

  private assertValidTarget(input: AddCartItemInput): void {
    const hasLivestock = Boolean(input.livestockId);
    const hasBulkListing = Boolean(input.bulkListingId);
    if (hasLivestock === hasBulkListing) {
      throw new BadRequestException(
        'Exactly one of livestockId or bulkListingId must be set',
      );
    }
    if (input.itemType === OrderItemType.LIVESTOCK && !hasLivestock) {
      throw new BadRequestException('itemType livestock requires livestockId');
    }
    if (input.itemType === OrderItemType.BULK_SHARE && !hasBulkListing) {
      throw new BadRequestException('itemType bulk_share requires bulkListingId');
    }
  }
}
