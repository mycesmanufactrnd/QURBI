import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderItemType } from './enums';
import { Cart } from './cart.entity';
import { Livestock } from './livestock.entity';
import { BulkListing } from './bulk-listing.entity';

// No price snapshot here on purpose — the cart always shows live prices;
// snapshotting only happens once at checkout, on order_items.
@Entity('cart_items')
export class CartItem extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @Column({ type: 'enum', enum: OrderItemType })
  itemType: OrderItemType;

  @Column({ type: 'varchar', length: 36, nullable: true })
  livestockId: string | null;

  // CASCADE: unlike order_items, a cart item has no snapshot to fall back on,
  // so if the listing it points at disappears the cart line is meaningless
  // and should disappear with it.
  @ManyToOne(() => Livestock, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'livestockId' })
  livestock: Livestock | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  bulkListingId: string | null;

  @ManyToOne(() => BulkListing, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bulkListingId' })
  bulkListing: BulkListing | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;
}
