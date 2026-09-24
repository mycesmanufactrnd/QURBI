import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RequestStatus } from './enums';
import { User } from './user.entity';
import { Species } from './species.entity';

// A farmer asking admin to add a species that isn't in the reference list yet.
// On approval the backend creates the Species row and links it here.
@Entity('species_requests')
export class SpeciesRequest extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  requestedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedByUserId' })
  requestedByUser: User;

  @Column({ type: 'varchar', length: 100 })
  proposedName: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdSpeciesId: string | null;

  @ManyToOne(() => Species, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdSpeciesId' })
  createdSpecies: Species | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;
}
