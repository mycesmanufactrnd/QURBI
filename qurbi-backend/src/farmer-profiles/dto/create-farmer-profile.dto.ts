import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

// No userId — the owner is always the authenticated caller (see
// FarmerProfilesController), never a value the client declares. No
// verificationStatus/ratingAverage/ratingCount/totalSales — those are
// system-controlled (verification review, order/rating flows), never
// client-set.
export class CreateFarmerProfileDto {
  @IsString()
  farmName: string;

  @IsOptional()
  @IsString()
  farmDescription?: string;

  @IsOptional()
  @IsString()
  businessRegNo?: string;

  @IsString()
  farmAddressLine: string;

  @IsString()
  farmCity: string;

  @IsString()
  farmState: string;

  @IsString()
  farmPostcode: string;

  @IsOptional()
  @IsLatitude()
  farmLatitude?: string;

  @IsOptional()
  @IsLongitude()
  farmLongitude?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  deliveryPreference?: string;
}
