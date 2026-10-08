import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum BuyerActivityType {
  LISTING_VIEW = 'listing_view',
  ADD_TO_CART = 'add_to_cart',
  BUY_NOW = 'buy_now',
  FARMER_PROFILE_VIEW = 'farmer_profile_view',
}

export enum BuyerActivityTargetType {
  LIVESTOCK = 'livestock',
  BULK_LISTING = 'bulk_listing',
  FARMER = 'farmer',
}

// Product analytics are deliberately separate from orders. An activity is an
// expression of buyer interest, not proof that a purchase happened.
@Entity('buyer_activities')
@Index(['farmerId', 'createdAt'])
@Index(['targetType', 'targetId', 'createdAt'])
export class BuyerActivity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  farmerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmerId' })
  farmer: User;

  // Null for a guest. Farmer analytics never returns this ID or buyer PII.
  @Column({ type: 'varchar', length: 36, nullable: true })
  viewerUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'viewerUserId' })
  viewer: User | null;

  @Column({ type: 'enum', enum: BuyerActivityType })
  eventType: BuyerActivityType;

  @Column({ type: 'enum', enum: BuyerActivityTargetType })
  targetType: BuyerActivityTargetType;

  @Column({ type: 'varchar', length: 36 })
  targetId: string;

  // Random per-browser-session ID. It supports guest uniqueness without
  // storing an IP address, fingerprint, email, or other personal data.
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;
}
