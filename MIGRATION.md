# QURBI Base44 to NestJS/MySQL migration

## Target architecture

- `qurbi-user`: buyer-facing React application.
- `qurbi-farmer`: farmer and superadmin React application.
- `qurbi-backend`: the shared NestJS REST API.
- XAMPP MySQL/MariaDB: local development database only.

The React applications must only call `VITE_API_BASE_URL`. They must not connect
directly to MySQL or retain a runtime dependency on Base44.

## Current migration status

| Area | Base44 source | NestJS target | Status |
| --- | --- | --- | --- |
| Authentication | `base44.auth` | `/api/auth/register`, `/api/auth/login`, `/api/auth/me` | Backend foundation ready |
| Users and roles | `User` | `users` table and `/api/users` | Entity/CRUD ready; ownership review pending |
| Farmer profiles | `FarmerProfile` | `farmer_profiles` | Entity/CRUD ready |
| Farmer verification | `FarmVerification` | `farm_verifications` | Entity/CRUD ready |
| Species and breeds | `Species`, `Breed` and requests | catalog/request modules | Entity/CRUD ready |
| Individual livestock | `Livestock` | livestock module | Entity/CRUD ready; reservation/expiry rules pending |
| Bulk selling | `BulkListing` | bulk-listings module | Entity/CRUD ready; compatibility audit pending |
| Cart | browser/Base44 order draft | carts and cart-items modules | Entity/CRUD ready; frontend pending |
| Orders | `Order` plus Base44 functions | orders module | Initial service ready; payment audit pending |
| Payment | Stripe Base44 functions | server-only Stripe module/webhook | Not started |
| Notifications | `Notification`, `FarmerNotification` | notifications module | Entity/CRUD ready; delivery mechanism pending |
| Uploads | Base44 Core UploadFile | NestJS upload/storage module | Not started |

## Rules that must survive migration

- Buyer, farmer and superadmin role boundaries.
- Farmer verification and species/breed approval.
- Individual listing marketplace eligibility and 14-day renewal.
- Exact-livestock 24-hour payment reservation without double selling.
- Bulk listing breed-level male/female counts.
- Farmer details must be loaded from the current farmer profile.
- Delivery tracking, refunds and buyer/farmer notifications.
- Policy acceptance and signature audit fields.

## Local setup

1. Start MySQL from XAMPP.
2. Create a database named `qurbi` with `utf8mb4` support.
3. Copy `qurbi-backend/.env.example` to `qurbi-backend/.env` and set a strong JWT secret.
4. Install backend dependencies with `npm ci`.
5. During disposable local schema bootstrap only, use `DB_SYNC=true`.
6. Before shared data is used, generate and commit a TypeORM migration, set `DB_SYNC=false`, and run `npm run migration:run`.

## Completion gate

- Both frontends build with no `@base44/sdk` or Base44 Vite plugin.
- `rg -i "base44" qurbi-user/src qurbi-farmer/src` finds no runtime integration.
- A fresh database can be built from committed migrations.
- Backend tests cover authorization, listing expiry, reservation concurrency and order transitions.
- User, Farmer and Superadmin journeys pass end-to-end tests.
