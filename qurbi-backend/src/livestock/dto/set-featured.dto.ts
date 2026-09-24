import { IsBoolean } from 'class-validator';

// Admin-only (see LivestockController) — homepage curation, not something a
// farmer can grant their own listing.
export class SetFeaturedDto {
  @IsBoolean()
  featured: boolean;
}
