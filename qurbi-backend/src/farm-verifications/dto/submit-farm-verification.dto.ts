import { IsObject, IsOptional, IsString } from 'class-validator';

// No farmerProfileId — it's always resolved from the authenticated caller's
// own farmer profile (see FarmVerificationsController/Service), never a
// value the client declares.
export class SubmitFarmVerificationDto {
  @IsObject()
  documents: Record<string, any>;

  @IsOptional()
  @IsString()
  signatureUrl?: string;
}
