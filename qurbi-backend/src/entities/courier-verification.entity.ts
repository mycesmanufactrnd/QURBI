import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CourierVerificationStatus } from './enums';
import { CourierProfile } from './courier-profile.entity';
import { User } from './user.entity';

// One row per submission attempt (not one per courier) so a rejected courier
// can resubmit and admins keep a full audit trail. The single "current"
// state is denormalised onto courierProfile.verificationStatus.
@Entity('courier_verifications')
export class CourierVerification extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  courierProfileId: string;

  @ManyToOne(() => CourierProfile, (profile) => profile.verifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courierProfileId' })
  courierProfile: CourierProfile;

  @Column({
    type: 'enum',
    enum: CourierVerificationStatus,
    default: CourierVerificationStatus.PENDING,
  })
  status: CourierVerificationStatus;

  // icFront, icBack, selfie, licence — private upload URLs.
  @Column({ type: 'json' })
  documents: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  signatureUrl: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;
}
