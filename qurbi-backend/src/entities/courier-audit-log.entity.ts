import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

// Append-only record of admin actions on couriers (approve, reject, suspend,
// reactivate, rate review, manual assign). Never updated or deleted.
@Entity('courier_audit_logs')
export class CourierAuditLog extends BaseEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  courierProfileId: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'json', nullable: true })
  detail: Record<string, any> | null;
}
