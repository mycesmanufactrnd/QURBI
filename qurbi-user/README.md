# QURBI User

Buyer-facing React application for QURBI.

## Architecture

- React and Vite frontend
- Firebase Authentication for Google sign-in only
- Axios for the QURBI NestJS API
- MySQL (`qurbidb`) as the application data store through NestJS

Firebase databases and Firebase Storage are not used.

## Local setup

1. Install dependencies with `npm install`.
2. Create `.env.local` with `VITE_API_BASE_URL` and the `VITE_FIREBASE_*` web configuration values.
3. Start the NestJS backend.
4. Run `npm run dev`.

The frontend defaults to port `5137` and the API defaults to `http://localhost:3000/api`.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`
