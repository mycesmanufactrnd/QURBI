import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RequestStatus } from './enums';
import { User } from './user.entity';
import { Species } from './species.entity';
import { Breed } from './breed.entity';

// Same pattern as SpeciesRequest, plus speciesId for which species the
// proposed breed sits under.
@Entity('breed_requests')
export class BreedRequest extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  requestedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedByUserId' })
  requestedByUser: User;

  @Column({ type: 'varchar', length: 36 })
  speciesId: string;

  @ManyToOne(() => Species, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'speciesId' })
  species: Species;

  @Column({ type: 'varchar', length: 100 })
  proposedName: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBreedId: string | null;

  @ManyToOne(() => Breed, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdBreedId' })
  createdBreed: Breed | null;

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
