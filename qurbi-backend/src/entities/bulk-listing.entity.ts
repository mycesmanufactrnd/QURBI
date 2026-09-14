import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BulkListingStatus } from './enums';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Species } from './species.entity';
import { Breed } from './breed.entity';

// An animal sold in shares (e.g. seven buyers sharing one cow for qurban).
//
// IMPORTANT: sharesSold must only ever be incremented inside a DB transaction
// that takes a row lock (SELECT ... FOR UPDATE) on this row first, then checks
// sharesSold < totalShares before writing. Without the lock, two buyers
// checking out at the same moment can both read "1 share left" and both
// succeed, overselling the animal.
@Entity('bulk_listings')
export class BulkListing extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  farmerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmerId' })
  farmer: User;

  // Optional link back to a single-animal listing this bulk sale was created from.
  @Column({ type: 'varchar', length: 36, nullable: true })
  livestockId: string | null;

  @ManyToOne(() => Livestock, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'livestockId' })
  livestock: Livestock | null;

  @Column({ type: 'varchar', length: 36 })
  speciesId: string;

  @ManyToOne(() => Species, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'speciesId' })
  species: Species;

  @Column({ type: 'varchar', length: 36, nullable: true })
  breedId: string | null;

  @ManyToOne(() => Breed, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'breedId' })
  breed: Breed | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  totalShares: number;

  @Column({ type: 'int', default: 0 })
  sharesSold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerShare: string;

  @Column({ type: 'varchar', length: 3, default: 'MYR' })
  currency: string;

  @Column({ type: 'json' })
  images: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  estimatedWeightKg: string | null;

  @Column({ type: 'date', nullable: true })
  scheduledDate: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  closesAt: Date | null;

  @Column({ type: 'enum', enum: BulkListingStatus, default: BulkListingStatus.DRAFT })
  status: BulkListingStatus;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;
}
