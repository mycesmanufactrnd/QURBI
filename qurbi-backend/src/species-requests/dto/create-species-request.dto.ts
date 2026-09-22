import { IsOptional, IsString } from 'class-validator';

// No requestedByUserId — the requester is always @CurrentUser(), never a
// value the client declares.
export class CreateSpeciesRequestDto {
  @IsString()
  proposedName: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
