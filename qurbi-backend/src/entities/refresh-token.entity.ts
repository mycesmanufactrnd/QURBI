import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

// One row per issued refresh token, so a session can be revoked server-side
// (unlike the stateless access token). Rotated on every /auth/refresh call:
// the old row is marked revoked and points at its replacement via
// replacedByTokenId, forming a chain that lets reuse of a revoked token be
// detected and treated as a signal the token was stolen.
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Never store the raw token — only a SHA-256 hash of it, so a DB read
  // alone can't be replayed as a valid session.
  @Column({ type: 'varchar', length: 255, unique: true })
  tokenHash: string;

  @Column({ type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  replacedByTokenId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
}
