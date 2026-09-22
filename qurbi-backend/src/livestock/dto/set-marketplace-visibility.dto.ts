import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Admin block: a real, independent fact (not derived from anything else).
// blocked: true requires a reason; blocked: false clears both fields
// regardless of what reason was sent.
export class SetMarketplaceBlockDto {
  @IsBoolean()
  blocked: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
