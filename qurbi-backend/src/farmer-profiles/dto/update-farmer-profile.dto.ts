import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

// Same exclusions as CreateFarmerProfileDto — no userId, no
// verificationStatus/ratingAverage/ratingCount/totalSales.
export class UpdateFarmerProfileDto {
  @IsOptional()
  @IsString()
  farmName?: string;

  @IsOptional()
  @IsString()
  farmDescription?: string;

  @IsOptional()
  @IsString()
  businessRegNo?: string;

  @IsOptional()
  @IsString()
  farmAddressLine?: string;

  @IsOptional()
  @IsString()
  farmCity?: string;

  @IsOptional()
  @IsString()
  farmState?: string;

  @IsOptional()
  @IsString()
  farmPostcode?: string;

  @IsOptional()
  @IsLatitude()
  farmLatitude?: string;

  @IsOptional()
  @IsLongitude()
  farmLongitude?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
