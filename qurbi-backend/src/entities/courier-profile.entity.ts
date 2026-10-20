import { Entity, Column, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CourierVerificationStatus, RequestStatus } from './enums';
import { User } from './user.entity';
import { CourierVerification } from './courier-verification.entity';

export interface CourierServiceArea {
  state: string;
  // Empty/absent = the whole state.
  districts?: string[];
}

// Split out from User for the same reason as FarmerProfile: only a courier
// carries these columns. Created together with the user at courier signup.
@Entity('courier_profiles')
export class CourierProfile extends BaseEntity {
  @Column({ type: 'varchar', length: 36, unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  icNumber: string;

  @Column({ type: 'varchar', length: 40 })
  vehicleType: string;

  @Column({ type: 'varchar', length: 20 })
  vehiclePlate: string;

  @Column({ type: 'json' })
  serviceAreas: CourierServiceArea[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankAccountNo: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  bankAccountHolder: string | null;

  // Current state; the audit trail of each attempt lives in
  // CourierVerification.
  @Column({
    type: 'enum',
    enum: CourierVerificationStatus,
    default: CourierVerificationStatus.UNVERIFIED,
  })
  verificationStatus: CourierVerificationStatus;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | null;

  // Only approved couriers can go online; the job pool is hidden while
  // offline.
  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  // The courier proposes a flat per-delivery earning; it only counts once an
  // admin approves it. approvedFee is what new assignments snapshot as their
  // earning (falling back to the order's delivery fee when null).
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  proposedFee: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  approvedFee: string | null;

  @Column({ type: 'enum', enum: RequestStatus, nullable: true })
  rateStatus: RequestStatus | null;

  @Column({ type: 'text', nullable: true })
  rateRejectionReason: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  rateReviewedByUserId: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  rateReviewedAt: Date | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  ratingAverage: string;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'int', default: 0 })
  totalDeliveries: number;

  @OneToMany(
    () => CourierVerification,
    (verification) => verification.courierProfile,
  )
  verifications: CourierVerification[];
}
