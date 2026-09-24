import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderItemType } from './enums';
import { Order } from './order.entity';
import { Livestock } from './livestock.entity';
import { BulkListing } from './bulk-listing.entity';

// New table — Base44 stored order contents as a JSON blob on the order itself,
// which makes questions like "how many of breed X sold this month" unanswerable
// without parsing every row. Splitting into real rows makes that a normal query.
@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: OrderItemType })
  itemType: OrderItemType;

  @Column({ type: 'varchar', length: 36, nullable: true })
  livestockId: string | null;

  // SET NULL: the snapshot columns below already froze what the buyer paid
  // for, so losing the live reference when a listing is later removed is fine.
  @ManyToOne(() => Livestock, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'livestockId' })
  livestock: Livestock | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  bulkListingId: string | null;

  @ManyToOne(() => BulkListing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bulkListingId' })
  bulkListing: BulkListing | null;

  // Frozen at purchase — a later price/title edit on the listing must never
  // rewrite what the buyer actually paid or bought.
  @Column({ type: 'varchar', length: 200 })
  titleSnapshot: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageSnapshot: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: string;

  // Per-animal notes (e.g. which share number, slaughter preference).
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;
}
