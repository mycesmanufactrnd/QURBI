const INITIAL_ENTRY_KEY = "qurbi_initial_entry_handled";

export function hasHandledInitialEntry() {
  try {
    return sessionStorage.getItem(INITIAL_ENTRY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInitialEntryHandled() {
  try {
    sessionStorage.setItem(INITIAL_ENTRY_KEY, "1");
  } catch {
    // Session storage may be unavailable in restricted browser contexts.
  }
}
