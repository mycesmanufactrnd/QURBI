// In-memory draft store for the Add Livestock -> Seller Policy flow.
// Persists across route navigation within the session (not localStorage);
// intentionally cleared on a fresh page load or after the listing is submitted.
let draft = null;

export function setDraft(data) {
  draft = data;
}

export function getDraft() {
  return draft;
}

export function clearDraft() {
  draft = null;
}