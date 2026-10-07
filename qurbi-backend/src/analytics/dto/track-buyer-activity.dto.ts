import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  BuyerActivityTargetType,
  BuyerActivityType,
} from '../../entities';

export class TrackBuyerActivityDto {
  @IsEnum(BuyerActivityType)
  eventType: BuyerActivityType;

  @IsEnum(BuyerActivityTargetType)
  targetType: BuyerActivityTargetType;

  @IsUUID()
  targetId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}
