import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationAudience, NotificationType } from '../../entities';

// Admin-only (see NotificationsController): pushing a notification to an
// arbitrary user is a privileged/system action, not something a user does to
// their own resource, so userId is a real, admin-supplied target here.
export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationAudience)
  audience: NotificationAudience;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  relatedType?: string;

  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
