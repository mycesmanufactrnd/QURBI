import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewMarketplaceComplianceDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
