import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { LivestockSex, LivestockStatus } from '../../entities';

// No farmerId — the owner is always the authenticated caller (see
// LivestockController), never a value the client declares. No
// marketplaceVisible/marketplaceVisibilityReason (derived, not stored — see
// LivestockService), no speciesApprovalStatus/breedApprovalStatus (mirrored
// from the corresponding species/breed request, never client-set), no
// adminBlocked/adminBlockReason (admin-only, its own endpoint).
export class CreateLivestockDto {
  @IsUUID()
  speciesId: string;

  @IsOptional()
  @IsUUID()
  breedId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  tagNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(LivestockSex)
  sex?: LivestockSex;

  @IsOptional()
  @IsInt()
  ageMonths?: number;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumberString()
  weightKg?: string;

  @IsNumberString()
  price: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @IsEnum(LivestockStatus)
  status?: LivestockStatus;

  @IsOptional()
  @IsDateString()
  marketplaceEligibleFrom?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
