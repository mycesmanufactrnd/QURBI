import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const FAILURE_CATEGORIES = [
  'buyer_unreachable',
  'wrong_address',
  'livestock_issue',
  'vehicle_issue',
  'other',
] as const;
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

// Captured on the courier's device at the moment of the shot. The server
// never trusts capturedAt on its own — it records its own receive time next
// to it (see CourierJobsService).
export class ProofMetaDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // Reported GPS accuracy radius in metres.
  @IsNumber()
  @Min(0)
  accuracy: number;

  // ISO-8601 timestamp from the device clock.
  @IsString()
  @MaxLength(40)
  capturedAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

export class ProofDto {
  // Private upload URLs (/uploads/private/<id>) of images the courier took
  // live and uploaded through POST /uploads.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photos: string[];

  @ValidateNested()
  @Type(() => ProofMetaDto)
  meta: ProofMetaDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ChecklistDto {
  @IsBoolean()
  earTagMatches: boolean;

  @IsBoolean()
  animalHealthy: boolean;

  @IsBoolean()
  animalSecured: boolean;
}

export class PickupDto extends ProofDto {
  @ValidateNested()
  @Type(() => ChecklistDto)
  checklist: ChecklistDto;
}

export class DeliverDto extends ProofDto {
  // The 6-digit code the buyer shows at handover.
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The delivery code must be 6 digits' })
  code: string;
}

export class FailDeliveryDto extends ProofDto {
  @IsIn(FAILURE_CATEGORIES)
  category: FailureCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class AdminAssignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  courierProfileId: string;
}

export class ResolveFailedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;
}
