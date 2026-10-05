import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { FirebasePortal } from './firebase-login.dto';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  // Which frontend is logging in. A farmer account logging into the buyer
  // portal acts as a buyer; omitted = the account's own role.
  @IsOptional()
  @IsEnum(FirebasePortal)
  portal?: FirebasePortal;
}
