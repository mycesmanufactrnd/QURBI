import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class CreateChipCheckoutDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds: string[];
}
