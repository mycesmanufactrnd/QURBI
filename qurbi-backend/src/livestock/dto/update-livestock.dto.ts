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

// Same exclusions as CreateLivestockDto — no farmerId, no derived visibility
// fields, no approval-status fields, no admin-block fields.
export class UpdateLivestockDto {
  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  breedId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  title?: string;

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

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  // DRAFT/AVAILABLE/RESERVED/UNAVAILABLE — publish/unpublish flow. SOLD is
  // set exclusively by LivestockService.markSold as part of checkout.
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
