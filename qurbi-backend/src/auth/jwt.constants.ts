import ms, { StringValue } from 'ms';

if (!process.env.JWT_SECRET) {
  // Fail loudly at boot rather than silently signing/verifying tokens with
  // `undefined` as the secret, which would accept anything.
  throw new Error(
    'JWT_SECRET environment variable is required but was not set. Set it in .env before starting the app.',
  );
}

const accessTtl = (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue;
const refreshTtl = (process.env.JWT_REFRESH_TTL ?? '7d') as StringValue;

export const jwtConstants = {
  secret: process.env.JWT_SECRET,
  accessTtl,
  refreshTtl,
  refreshTtlMs: ms(refreshTtl),
};
