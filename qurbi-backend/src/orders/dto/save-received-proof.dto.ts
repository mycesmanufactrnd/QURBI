import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SaveReceivedProofDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  proofImages: string[];
}
