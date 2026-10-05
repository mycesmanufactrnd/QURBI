import { IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../entities';

export class SwitchRoleDto {
  // Admin is deliberately not switchable; the service rejects it.
  @IsEnum(UserRole)
  role: UserRole;

  // Identifies the session being switched, so only that session changes role.
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
