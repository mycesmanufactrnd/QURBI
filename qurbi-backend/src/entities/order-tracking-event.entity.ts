import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderStatus, ProofStage } from './enums';
import { Order } from './order.entity';
import { User } from './user.entity';

// The delivery timeline both apps render. Append-only — never update or
// delete a row here — so that when a buyer and farmer disagree about what
// happened, there's a tamper-evident history to check.
@Entity('order_tracking_events')
export class OrderTrackingEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.trackingEvents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  // Proof-photo metadata. All null for events that are not courier proof
  // (farmer/system/buyer events, legacy rows).
  @Column({ type: 'enum', enum: ProofStage, nullable: true })
  stage: ProofStage | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  deliveryAssignmentId: string | null;

  // Device clock at capture vs. server clock at upload. The server value is
  // the one to trust; the gap between them is what a late upload looks like.
  @Column({ type: 'datetime', precision: 6, nullable: true })
  capturedAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  serverReceivedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'int', nullable: true })
  accuracyMeters: number | null;

  // SHA-256 of each stored image, in the same order as `images`.
  @Column({ type: 'json', nullable: true })
  imageHashes: string[] | null;

  // Anomalies the server noticed (gps_mismatch, late_upload, ...). Flagged,
  // not blocked � admins review them.
  @Column({ type: 'json', nullable: true })
  flags: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  // Null for automated/system-generated events (e.g. a payment webhook).
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;
}
