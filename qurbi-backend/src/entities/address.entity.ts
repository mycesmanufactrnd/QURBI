import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AddressLabel } from './enums';
import { User } from './user.entity';

// Replaces the localStorage address book so it survives a phone change.
@Entity('addresses')
export class Address extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: AddressLabel, default: AddressLabel.HOME })
  label: AddressLabel;

  @Column({ type: 'varchar', length: 150 })
  recipientName: string;

  @Column({ type: 'varchar', length: 30 })
  recipientPhone: string;

  @Column({ type: 'varchar', length: 255 })
  addressLine1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'varchar', length: 20 })
  postcode: string;

  @Column({ type: 'varchar', length: 100, default: 'Malaysia' })
  country: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'text', nullable: true })
  deliveryNote: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;
}
