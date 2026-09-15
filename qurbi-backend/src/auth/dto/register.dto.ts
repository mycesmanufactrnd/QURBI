import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../entities';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(8, 72)
  password: string;

  @IsString()
  @Length(2, 150)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsIn([UserRole.BUYER, UserRole.FARMER])
  role: UserRole.BUYER | UserRole.FARMER;
}
