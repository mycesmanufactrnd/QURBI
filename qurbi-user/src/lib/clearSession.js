/**
 * Clears legacy global session keys from the old shared-key scheme.
 * Per-user keys (gh_profile_<id>, gh_addresses_<id>, gh_selected_addr_<id>)
 * are intentionally preserved so each user's details restore on their next login.
 */
export function clearSession() {
  try {
    ["gh_user_profile", "gh_user_addresses", "gh_selected_address_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
  } catch {
    // localStorage may be unavailable; nothing to clear
  }
}