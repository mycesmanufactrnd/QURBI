import { IsArray, IsString } from 'class-validator';

export class MarkReceivedDto {
  @IsArray()
  @IsString({ each: true })
  proofImages: string[];
}
