import { EntityManager } from 'typeorm';
import {
  Notification,
  NotificationAudience,
  NotificationType,
  User,
  UserRole,
  UserStatus,
} from '../entities';

interface NotifyInput {
  userId: string;
  audience: NotificationAudience;
  type?: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  relatedType?: string;
  relatedId?: string;
}

// Always called with the transaction's manager so a notification can never
// exist without the change it announces (or the other way round).
export async function notify(
  manager: EntityManager,
  input: NotifyInput,
): Promise<void> {
  await manager.save(
    manager.create(Notification, {
      userId: input.userId,
      audience: input.audience,
      type: input.type ?? NotificationType.ORDER_UPDATE,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    }),
  );
}

export async function notifyAdmins(
  manager: EntityManager,
  input: Omit<NotifyInput, 'userId' | 'audience'>,
): Promise<void> {
  const admins = await manager.find(User, {
    where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify(manager, {
      ...input,
      userId: admin.id,
      audience: NotificationAudience.ADMIN,
    });
  }
}
