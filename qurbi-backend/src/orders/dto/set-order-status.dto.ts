import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../entities';

// Shared by both the admin-only generic PATCH /:id/status and the
// farmer/admin PATCH /:id/advance — same shape, different authorization
// rules applied in OrdersController/OrdersService. No userId field: the
// actor for the resulting tracking event always comes from @CurrentUser().
export class SetOrderStatusDto {
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
