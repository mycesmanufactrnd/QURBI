import { UserRole } from '../entities';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}
