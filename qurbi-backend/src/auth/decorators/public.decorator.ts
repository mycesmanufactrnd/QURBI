import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route as exempt from the global JwtAuthGuard. Everything else is
// default-deny — this is the only way in.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
