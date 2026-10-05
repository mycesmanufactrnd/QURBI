import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { PaymentSession } from './payment-session.entity';

@Entity('payment_session_orders')
@Index('uq_payment_session_order', ['paymentSessionId', 'orderId'], { unique: true })
export class PaymentSessionOrder extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 36 })
  paymentSessionId: string;

  @ManyToOne(() => PaymentSession, (session) => session.orderLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentSessionId' })
  paymentSession: PaymentSession;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
