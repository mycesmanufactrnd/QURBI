import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationAudience } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class NotificationsService extends BaseCrudService<Notification> {
  constructor(@InjectRepository(Notification) repository: Repository<Notification>) {
    super(repository);
  }

  // audience keeps a buyer's and farmer's inboxes separate for someone who is
  // both, and isCleared excludes anything the user already "cleared".
  findInbox(userId: string, audience: NotificationAudience): Promise<Notification[]> {
    return this.repository.find({
      where: { userId, audience, isCleared: false },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string): Promise<Notification> {
    await this.repository.update(id, { isRead: true, readAt: new Date() });
    return this.findOne(id);
  }

  async markAllRead(userId: string, audience: NotificationAudience): Promise<void> {
    await this.repository.update({ userId, audience, isRead: false }, {
      isRead: true,
      readAt: new Date(),
    });
  }

  // Soft delete — "clear all" must never destroy the underlying record.
  async clear(id: string): Promise<Notification> {
    await this.repository.update(id, { isCleared: true });
    return this.findOne(id);
  }

  async clearAll(userId: string, audience: NotificationAudience): Promise<void> {
    await this.repository.update({ userId, audience }, { isCleared: true });
  }
}
