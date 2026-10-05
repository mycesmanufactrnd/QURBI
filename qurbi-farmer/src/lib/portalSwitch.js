import { authApi, getRefreshToken } from "@/api/apiClient";

const BUYER_PORTAL_URL = (import.meta.env.VITE_BUYER_PORTAL_URL || "http://localhost:5137").replace(/\/$/, "");

/**
 * Asks the API for a buyer session on the same account and hands it to the
 * buyer portal. The tokens travel in the URL fragment, which browsers never
 * send to a server or log; the receiving page stores them and clears it.
 */
export async function switchToBuyerPortal() {
  const session = await authApi.switchRole("buyer", getRefreshToken());
  const fragment = new URLSearchParams({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    next: "/",
  });
  window.location.assign(`${BUYER_PORTAL_URL}/switch-session#${fragment}`);
}
