import { createClient } from 'npm:@base44/sdk@0.8.40';

// QURBI User (buyer) app — cross-app read credentials.
// Hardcoded per the builder's decision (mirrors the User app's fetchLivestock pattern).
export const QURBI_USER_APP_ID = "6a22824084a6dd7fc49dba93";
export const QURBI_USER_API_KEY = "44bc036a2ae04df7a44dbf7503e837e3";

export function createQurbiUserClient() {
  return createClient({
    appId: QURBI_USER_APP_ID,
    headers: { api_key: QURBI_USER_API_KEY },
  });
}