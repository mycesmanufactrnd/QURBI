const STORAGE_KEY = "qurbi_farmer_verification_draft";

export function getFarmerVerificationDraft() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveFarmerVerificationDraft(draft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The policy page will still guard against an absent draft.
  }
}

export function clearFarmerVerificationDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required if storage is unavailable.
  }
}
