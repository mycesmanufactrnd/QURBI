import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { NotificationAudience, NotificationType } from './enums';
import { User } from './user.entity';

// Replaces FarmerNotification and User Notification. The `audience` column is
// what lets one table serve both apps and still keep the two inboxes separate
// for someone who is both a buyer and a farmer.
@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: NotificationAudience })
  audience: NotificationAudience;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  linkUrl: string | null;

  // What this notification is about, e.g. relatedType: 'order', relatedId: <orderId>.
  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedType: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  relatedId: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  readAt: Date | null;

  // Soft delete so "clear all" doesn't destroy the underlying record.
  @Column({ type: 'boolean', default: false })
  isCleared: boolean;
}
