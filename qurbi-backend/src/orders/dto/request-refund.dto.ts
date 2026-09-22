import { IsString, MinLength } from 'class-validator';

export class RequestRefundDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
