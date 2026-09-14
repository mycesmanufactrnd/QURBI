import { Entity, Column, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { CartItem } from './cart-item.entity';

// Replaces the localStorage cart so it survives a phone change and stays in
// sync across devices for the same account.
@Entity('carts')
export class Cart extends BaseEntity {
  @Column({ type: 'varchar', length: 36, unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
  items: CartItem[];
}
