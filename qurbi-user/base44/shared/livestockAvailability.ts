const BUYER_VISIBLE_BREED_STATUSES = new Set(['approved', 'unspecified']);
const MIN_MARKETPLACE_AGE_MONTHS: Record<string, number> = {
  Cow: 6,
  Goat: 4,
  Sheep: 3,
};

function normalized(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function elapsedWholeMonths(from: Date, to: Date) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function ageInMonths(livestock: any, today = new Date()) {
  if (livestock.ageInputMode === 'Birth Date' && livestock.birthDate) {
    const birthDate = new Date(`${livestock.birthDate}T00:00:00`);
    if (!Number.isNaN(birthDate.getTime()) && birthDate <= today) return elapsedWholeMonths(birthDate, today);
  }

  const value = Number(livestock.ageValue);
  if (Number.isFinite(value) && value >= 0) {
    const startingMonths = livestock.ageUnit === 'Years' ? value * 12 : value;
    const recordedAt = livestock.ageRecordedAt ? new Date(`${livestock.ageRecordedAt}T00:00:00`) : today;
    const elapsed = Number.isNaN(recordedAt.getTime()) ? 0 : elapsedWholeMonths(recordedAt, today);
    return Math.floor(startingMonths + elapsed);
  }

  const legacyAge = String(livestock.age || '');
  const years = Number(legacyAge.match(/([\d.]+)\s*year/i)?.[1] || 0);
  const months = Number(legacyAge.match(/([\d.]+)\s*month/i)?.[1] || 0);
  if (years || months) return Math.floor(years * 12 + months);
  return null;
}

export function livestockMarketplaceState(livestock: any) {
  if (!livestock) return { available: false, state: 'not_found' };
  if (livestock.disabled) return { available: false, state: 'disabled' };
  if (normalized(livestock.status) !== 'available') {
    return { available: false, state: 'unavailable_status' };
  }
  if (normalized(livestock.speciesApprovalStatus) !== 'approved') {
    return { available: false, state: 'species_not_approved' };
  }
  if (!BUYER_VISIBLE_BREED_STATUSES.has(normalized(livestock.breedApprovalStatus))) {
    return { available: false, state: 'breed_not_approved' };
  }
  const minimumAge = MIN_MARKETPLACE_AGE_MONTHS[livestock.species];
  const currentAge = ageInMonths(livestock);
  if (minimumAge && (currentAge === null || currentAge < minimumAge)) {
    return { available: false, state: 'below_marketplace_age', minimumAge };
  }
  if (livestock.marketplaceVisible !== true) {
    const reason = normalized(livestock.marketplaceVisibilityReason);
    const staleAgeDecision = reason.includes('month marketplace threshold') || reason === 'age could not be verified';
    if (!staleAgeDecision) return { available: false, state: 'marketplace_hidden' };
  }
  return { available: true, state: 'available' };
}

export function isLivestockMarketplaceAvailable(livestock: any) {
  return livestockMarketplaceState(livestock).available;
}
