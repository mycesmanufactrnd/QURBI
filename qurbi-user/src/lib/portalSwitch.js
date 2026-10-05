import { authApi, getRefreshToken } from "@/api/apiClient";

const FARMER_PORTAL_URL = (import.meta.env.VITE_FARMER_PORTAL_URL || "http://localhost:5173").replace(/\/$/, "");

// Tokens travel in the URL fragment, which browsers never send to a server or
// log; the farmer portal stores them and clears it (see its SwitchSession page).
function openFarmerPortal(session, next) {
  const fragment = new URLSearchParams({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    next,
  });
  window.location.assign(`${FARMER_PORTAL_URL}/switch-session#${fragment}`);
}

/** An existing farmer account acting as a buyer goes back to the farmer side. */
export async function switchToFarmerPortal() {
  openFarmerPortal(await authApi.switchRole("farmer", getRefreshToken()), "/");
}

/**
 * A buyer registering as a farmer: upgrades the account, then continues in the
 * farmer portal at the farm verification step.
 */
export async function registerAsFarmer() {
  openFarmerPortal(await authApi.becomeFarmer(getRefreshToken()), "/verify");
}
