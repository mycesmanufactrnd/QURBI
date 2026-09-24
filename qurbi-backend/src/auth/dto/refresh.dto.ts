import { IsString, MinLength } from 'class-validator';

// Shared shape for both /auth/refresh and /auth/logout — both just take the
// raw refresh token presented by the client.
export class RefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
