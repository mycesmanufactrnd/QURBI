import { IsString, MinLength } from 'class-validator';

export class FirebaseLoginDto {
  @IsString()
  @MinLength(1)
  idToken: string;
}
