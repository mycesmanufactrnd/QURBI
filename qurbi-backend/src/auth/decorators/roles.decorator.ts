import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities';

export const ROLES_KEY = 'roles';

// Pair with @UseGuards(RolesGuard) on the same route/controller. Deliberately
// not a global guard — global guard ordering across modules isn't something
// Nest guarantees, whereas "global guard, then route guard" is guaranteed, so
// this stays a local guard applied next to JwtAuthGuard's global instance.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
