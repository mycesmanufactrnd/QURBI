import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const COURIER_VEHICLE_TYPES = [
  'motorcycle',
  'car',
  'pickup',
  'van',
  'lorry',
] as const;

export class ServiceAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  districts?: string[];
}

// Account + profile fields only. Documents (IC, selfie, licence) need an
// authenticated upload, so they are submitted in a second step
// (SubmitCourierVerificationDto) after the first login — same shape as the
// farmer onboarding.
export class RegisterCourierDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(30)
  icNumber: string;

  @IsIn(COURIER_VEHICLE_TYPES)
  vehicleType: (typeof COURIER_VEHICLE_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehiclePlate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  serviceAreas: ServiceAreaDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bankAccountHolder?: string;

  // Must be an explicit true — recorded as the policy/agreement acceptance.
  @IsBoolean()
  @Equals(true, { message: 'You must accept the courier terms to register' })
  acceptTerms: boolean;
}

export class SubmitCourierVerificationDto {
  // icFront, icBack, selfie, licence — private upload URLs
  // (/uploads/private/<id>) from POST /uploads.
  @IsObject()
  documents: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  signatureUrl?: string;
}

export class UpdateCourierProfileDto {
  @IsOptional()
  @IsIn(COURIER_VEHICLE_TYPES)
  vehicleType?: (typeof COURIER_VEHICLE_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehiclePlate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  serviceAreas?: ServiceAreaDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bankAccountHolder?: string;
}

export class SetOnlineDto {
  @IsBoolean()
  online: boolean;
}

export class ProposeRateDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  fee: number;
}

export class ReviewCourierVerificationDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}

export class SuspendCourierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ReviewRateDto {
  @IsBoolean()
  approve: boolean;

  // Admin may approve a different amount than the one proposed.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  approvedFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
