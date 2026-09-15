import { IsOptional, IsString, IsUUID } from 'class-validator';

// No requestedByUserId — the requester is always @CurrentUser(), never a
// value the client declares.
export class CreateBreedRequestDto {
  @IsUUID()
  speciesId: string;

  @IsString()
  proposedName: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
