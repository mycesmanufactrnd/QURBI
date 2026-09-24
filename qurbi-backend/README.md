# QURBI Backend

Shared NestJS and MySQL backend for the QURBI Buyer, Farmer and Superadmin portals.
Firebase verifies Google identity only; application users, roles, livestock,
orders and all other shared data remain in MySQL.

## Local setup

1. Start MySQL in XAMPP.
2. Create/import the `qurbidb` database.
3. Copy `.env.example` to `.env` and fill in the local values.
4. Install dependencies and seed reference data:

```powershell
npm install
npm run seed:reference-data
```

5. Start the API:

```powershell
npm run start:dev
```

The default API base URL is `http://localhost:3000/api`.

## Shared Firebase login contract

Both frontends exchange a Firebase ID token at `POST /api/auth/firebase`:

```json
{
  "idToken": "<Firebase ID token>",
  "portal": "buyer"
}
```

Use `portal: "buyer"` from QURBI User and `portal: "farmer"` from QURBI
Farmer. The portal selects the role only when a new user is created. An
existing user's role is never overwritten. The response contains QURBI
`accessToken` and `refreshToken`; normal API calls use the QURBI access token.

## Database synchronization

`DB_SYNC=true` is convenient for an empty local development database. Set it
to `false` outside local development. Production database changes must use
reviewed migrations instead of TypeORM automatic synchronization.

## Livestock marketplace lifecycle

An AVAILABLE livestock listing is visible for 14 days. After expiry it becomes
UNAVAILABLE and disappears from Buyer results. The Farmer still sees it in
their inventory and can review the details/price and publish it as AVAILABLE
again, which starts a new 14-day window.

## Verification commands

```powershell
npm test -- --runInBand
npm run build
npx ts-node -r tsconfig-paths/register scripts/validate-entities.ts
```
