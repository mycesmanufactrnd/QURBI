import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderStatus } from '../../entities';

// No createdByUserId — the actor always comes from @CurrentUser(), never the body.
export class CreateOrderTrackingEventDto {
  @IsUUID()
  orderId: string;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  location?: string;
}
