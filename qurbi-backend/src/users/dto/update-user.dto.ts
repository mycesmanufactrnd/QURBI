import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole, UserStatus } from '../../entities';

// fullName/phone/avatarUrl are self-editable by the account owner. role and
// status are admin-only fields — UsersController rejects them from a
// non-admin actor's own PATCH rather than silently accepting or applying
// them (see UsersController.update), so a self-edit can never smuggle in a
// role/status change.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
