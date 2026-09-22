import { IsBoolean, IsOptional, IsString } from 'class-validator';

// No reviewedByUserId — the reviewer is always @CurrentUser(), admin-only.
export class ReviewBreedRequestDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
