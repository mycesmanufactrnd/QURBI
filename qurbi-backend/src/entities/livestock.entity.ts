import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LivestockStatus, LivestockSex, ReservationState } from './enums';
import { User } from './user.entity';
import { Species } from './species.entity';
import { Breed } from './breed.entity';
import { LivestockCategory } from './livestock-category.entity';

// A single animal for sale. The farmer app creates rows here, the buyer app
// only reads them — same table, no more sync functions between two databases.
@Entity('livestock')
export class Livestock extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  farmerId: string;

  // Deleting a farmer's account takes their listings with it.
  @ManyToOne(() => User, (user) => user.livestock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmerId' })
  farmer: User;

  @Column({ type: 'varchar', length: 36 })
  speciesId: string;

  // RESTRICT: species is reference data — block deleting a species while any
  // listing still points at it rather than silently orphaning the listing.
  @ManyToOne(() => Species, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'speciesId' })
  species: Species;

  @Column({ type: 'varchar', length: 36, nullable: true })
  breedId: string | null;

  @ManyToOne(() => Breed, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'breedId' })
  breed: Breed | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  categoryId: string | null;

  @ManyToOne(() => LivestockCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: LivestockCategory | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tagNumber: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: LivestockSex, nullable: true })
  sex: LivestockSex | null;

  @Column({ type: 'int', nullable: true })
  ageMonths: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  weightKg: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'varchar', length: 3, default: 'MYR' })
  currency: string;

  @Column({ type: 'json' })
  images: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  videoUrl: string | null;

  @Column({
    type: 'enum',
    enum: LivestockStatus,
    default: LivestockStatus.DRAFT,
  })
  status: LivestockStatus;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  listingPublishedAt: Date | null;

  @Index()
  @Column({ type: 'datetime', precision: 6, nullable: true })
  listingExpiresAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  listingRenewedAt: Date | null;

  @Column({ type: 'enum', enum: ReservationState, nullable: true })
  reservationState: ReservationState | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reservationOrderId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, select: false })
  reservationBuyerId: string | null;

  @Index()
  @Column({ type: 'datetime', precision: 6, nullable: true })
  reservationExpiresAt: Date | null;

  // Health records, feed type, vaccination history — free-form, farmer-defined.
  @Column({ type: 'json', nullable: true })
  attributes: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  soldAt: Date | null;
}
