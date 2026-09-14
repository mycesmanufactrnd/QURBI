import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

// Marketing/browse groupings for the buyer home page ("Korban 2026", "Aqiqah").
// Deliberately separate from Species: species is what the animal IS, category
// is how you SELL it — one species can appear under several categories.
@Entity('livestock_categories')
export class LivestockCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;
}
