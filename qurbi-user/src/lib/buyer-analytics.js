import apiClient from "@/api/apiClient";

const SESSION_KEY = "qurbi_analytics_session";

function sessionId() {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  } catch {
    return undefined;
  }
}

// Analytics must never interrupt shopping. Failed telemetry is intentionally
// swallowed; checkout and cart actions remain the source of truth.
export function trackBuyerActivity({ eventType, targetType, targetId, source }) {
  if (!targetId) return Promise.resolve();
  return apiClient
    .post("/analytics/events", {
      eventType,
      targetType,
      targetId,
      sessionId: sessionId(),
      source,
    })
    .catch(() => undefined);
}

export function analyticsSource(searchParams) {
  if (searchParams?.get("from")) return searchParams.get("from");
  try {
    const path = new URL(document.referrer).pathname;
    if (path === "/") return "home";
    if (path.includes("bulk-buy")) return "bulk_buy";
    if (path.includes("browse")) return "browse";
  } catch {
    // Direct visit or an invalid/hidden referrer.
  }
  return "direct";
}
