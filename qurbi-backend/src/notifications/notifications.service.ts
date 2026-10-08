import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  Notification,
  NotificationAudience,
  NotificationType,
  OrderTrackingEvent,
  UserRole,
} from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class NotificationsService extends BaseCrudService<Notification> {
  constructor(
    @InjectRepository(Notification) repository: Repository<Notification>,
    @InjectRepository(OrderTrackingEvent)
    private readonly trackingEventRepository: Repository<OrderTrackingEvent>,
  ) {
    super(repository);
  }

  // audience keeps a buyer's and farmer's inboxes separate for someone who is
  // both, and isCleared excludes anything the user already "cleared".
  async findInbox(
    userId: string,
    audience: NotificationAudience,
  ): Promise<Array<Notification & { imageUrl: string | null }>> {
    const notifications = await this.repository.find({
      where: { userId, audience, isCleared: false },
      order: { createdAt: 'DESC' },
    });
    const deliveryNotifications = notifications.filter(
      (notification) => notification.type === NotificationType.DELIVERY,
    );
    const eventIds = deliveryNotifications
      .filter(
        (notification) =>
          notification.relatedType === 'order_tracking_event' &&
          notification.relatedId,
      )
      .map((notification) => notification.relatedId as string);
    const orderIds = deliveryNotifications
      .filter(
        (notification) =>
          notification.relatedType === 'order' && notification.relatedId,
      )
      .map((notification) => notification.relatedId as string);

    const exactEventsPromise: Promise<OrderTrackingEvent[]> = eventIds.length
      ? this.trackingEventRepository.find({ where: { id: In(eventIds) } })
      : Promise.resolve([]);
    const legacyEventsPromise: Promise<OrderTrackingEvent[]> = orderIds.length
      ? this.trackingEventRepository.find({
          where: {
            orderId: In(orderIds),
            images: Not(IsNull()),
          },
          order: { createdAt: 'DESC' },
        })
      : Promise.resolve([]);
    const [exactEvents, legacyEvents] = await Promise.all([
      exactEventsPromise,
      legacyEventsPromise,
    ]);
    const exactById = new Map(exactEvents.map((event) => [event.id, event]));
    const latestByOrder = new Map<string, OrderTrackingEvent>();
    for (const event of legacyEvents) {
      if (!latestByOrder.has(event.orderId)) latestByOrder.set(event.orderId, event);
    }

    return notifications.map((notification) => {
      const event =
        notification.relatedType === 'order_tracking_event'
          ? exactById.get(notification.relatedId || '')
          : notification.relatedType === 'order'
            ? latestByOrder.get(notification.relatedId || '')
            : undefined;
      const imageUrl = Array.isArray(event?.images) ? event.images[0] || null : null;
      return Object.assign(notification, { imageUrl });
    });
  }

  // Fetches a notification and confirms `viewer` owns it (or is an admin).
  // Anyone else gets the exact same 404 a made-up id would return.
  private async findOwned(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<Notification> {
    const notification = await this.findOne(id);
    if (viewer.role !== UserRole.ADMIN && notification.userId !== viewer.id) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }

  async markRead(id: string, viewer: AuthenticatedUser): Promise<Notification> {
    await this.findOwned(id, viewer);
    await this.repository.update(id, { isRead: true, readAt: new Date() });
    return this.findOne(id);
  }

  async markAllRead(
    userId: string,
    audience: NotificationAudience,
  ): Promise<void> {
    await this.repository.update(
      { userId, audience, isRead: false },
      {
        isRead: true,
        readAt: new Date(),
      },
    );
  }

  // Soft delete — "clear all" must never destroy the underlying record.
  async clear(id: string, viewer: AuthenticatedUser): Promise<Notification> {
    await this.findOwned(id, viewer);
    await this.repository.update(id, { isCleared: true });
    return this.findOne(id);
  }

  async clearAll(
    userId: string,
    audience: NotificationAudience,
  ): Promise<void> {
    await this.repository.update({ userId, audience }, { isCleared: true });
  }
}
