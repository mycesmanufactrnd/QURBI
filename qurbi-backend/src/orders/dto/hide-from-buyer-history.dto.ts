import { IsBoolean } from 'class-validator';

export class HideFromBuyerHistoryDto {
  @IsBoolean()
  hidden: boolean;
}
