import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../entities';

// Admin-only (see UsersController) — an escape hatch for creating a user row
// directly, bypassing the normal /auth/register flow. No passwordHash: that
// lifecycle belongs entirely to AuthService, never to this service.
export class CreateUserDto {
  @IsString()
  email: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole)
  role: UserRole;
}
