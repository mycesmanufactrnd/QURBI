import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentStatus } from './enums';
import { PaymentSessionOrder } from './payment-session-order.entity';

@Entity('payment_sessions')
export class PaymentSession extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 36 })
  buyerId: string;

  @Column({ type: 'varchar', length: 30, default: 'chip' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  providerStatus: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'MYR' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  checkoutUrl: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  failureMessage: string | null;

  @Column({ type: 'boolean', default: true })
  isTest: boolean;

  @OneToMany(() => PaymentSessionOrder, (link) => link.paymentSession, { cascade: true })
  orderLinks: PaymentSessionOrder[];
}
