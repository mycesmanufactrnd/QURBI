import { IsBoolean, IsOptional, IsString } from 'class-validator';

// No reviewedByUserId — that was the actual hole (the caller declaring who
// they are). The reviewer is always @CurrentUser(), admin-only via @Roles.
export class ReviewRefundDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
