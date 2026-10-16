// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in, e.g. the MCP OAuth consent page). Keep the redirect
// validation in one place — it is security-sensitive and easy to drift.

// Resolve ?returnTo= to a safe same-origin path, else "/".
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
const AUTH_RETURN_TO_KEY = "qurbi_auth_return_to";

export function rememberAuthReturnTo(returnTo) {
  try {
    sessionStorage.setItem(AUTH_RETURN_TO_KEY, returnTo);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export function clearRememberedAuthReturnTo() {
  try {
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export function safeReturnTo(candidate = null) {
  let remembered = null;
  try {
    remembered = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
  const raw = candidate || remembered || new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    // Strip obsolete platform bootstrap parameters so a crafted return target
    // cannot carry stale tokens or redirect configuration into a new session.
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
    return path;
  } catch {
    return "/";
  }
}
