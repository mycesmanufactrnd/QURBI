import { IsEnum, IsString, MinLength } from 'class-validator';

export enum FirebasePortal {
  BUYER = 'buyer',
  FARMER = 'farmer',
}

export class FirebaseLoginDto {
  @IsString()
  @MinLength(1)
  idToken: string;

  // Identifies which frontend initiated a first-time Firebase login. It is
  // used only to choose the role for a brand-new account; existing roles are
  // never changed based on this client-provided value.
  @IsEnum(FirebasePortal)
  portal: FirebasePortal;
}
