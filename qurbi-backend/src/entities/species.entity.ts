import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Breed } from './breed.entity';

// Admin reference data (Lembu, Kambing, ...). Was duplicated per-app before
// the merge; now a single source of truth both frontends read.
@Entity('species')
export class Species extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  // Qurban share count for this species — 7 for cattle/buffalo, 1 for goats/sheep.
  @Column({ type: 'int', default: 1 })
  maxShares: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => Breed, (breed) => breed.species)
  breeds: Breed[];
}
