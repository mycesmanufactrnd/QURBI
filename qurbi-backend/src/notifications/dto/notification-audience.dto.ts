import { IsEnum } from 'class-validator';
import { NotificationAudience } from '../../entities';

export class NotificationAudienceDto {
  @IsEnum(NotificationAudience)
  audience: NotificationAudience;
}
