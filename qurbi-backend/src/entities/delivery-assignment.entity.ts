import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { DeliveryAssignmentStatus } from './enums';
import { Order } from './order.entity';
import { CourierProfile } from './courier-profile.entity';

export interface PickupChecklist {
  earTagMatches: boolean;
  animalHealthy: boolean;
  animalSecured: boolean;
}

// One row per courier attempt at an order. A failed or released attempt stays
// as history and the order can get a new assignment, so at most one row per
// order is "active" (not FAILED/CANCELLED) — CourierJobsService enforces that
// under a row lock on the order.
@Entity('delivery_assignments')
@Index(['orderId', 'status'])
export class DeliveryAssignment extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.deliveryAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 36 })
  courierProfileId: string;

  @ManyToOne(() => CourierProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'courierProfileId' })
  courierProfile: CourierProfile;

  // Denormalised so "my jobs" and the photo-access check never join through
  // the profile.
  @Index()
  @Column({ type: 'varchar', length: 36 })
  courierUserId: string;

  @Column({
    type: 'enum',
    enum: DeliveryAssignmentStatus,
    default: DeliveryAssignmentStatus.ACCEPTED,
  })
  status: DeliveryAssignmentStatus;

  // Snapshotted at accept time from the courier's approved rate (or the
  // order's delivery fee), so a later rate change never rewrites history.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  earningAmount: string;

  @Column({ type: 'boolean', default: false })
  assignedByAdmin: boolean;

  @Column({ type: 'datetime', precision: 6 })
  acceptedAt: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  pickedUpAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  inTransitAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  failedAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  failureCategory: string | null;

  @Column({ type: 'text', nullable: true })
  failedReason: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'json', nullable: true })
  pickupChecklist: PickupChecklist | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  farmerHandoverConfirmedAt: Date | null;

  // Set once a "stuck" alert has gone out for the current stage, so the
  // scheduler never spams the same alert every run.
  @Column({ type: 'datetime', precision: 6, nullable: true })
  delayAlertedAt: Date | null;
}
