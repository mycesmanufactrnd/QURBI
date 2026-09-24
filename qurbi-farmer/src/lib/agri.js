// Shared domain constants for QURBI Farmer.

export const MALAYSIA_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Putrajaya",
  "Labuan",
];

export function malaysiaState(...values) {
  return values.find((value) => MALAYSIA_STATES.includes(value)) || "";
}

// Phase 1 currently accepts Cow and Goat only. Legacy species data is kept in
// the backend, but it is not offered when creating or editing a listing.
export const SPECIES = ["Cow", "Goat"];

export function speciesOptions() {
  return [...SPECIES];
}

// Initial Malaysia-relevant options based on DVS livestock breed guidance.
// Admin-managed Breed records are merged into these lists at runtime.
export const BREEDS_BY_SPECIES = {
  Cow: [
    "Kedah-Kelantan (KK)",
    "Brahman",
    "Droughtmaster",
    "Mafriwal",
    "Local Indian Dairy (LID)",
    "Australian Commercial Cross",
    "Charolais",
    "Simmental",
    "Limousin",
    "Jersey",
    "Holstein Friesian",
    "Crossbreed",
    "Unspecified",
  ],
  Goat: [
    "Katjang",
    "Boer",
    "Jamnapari",
    "Jermasia",
    "Kalahari Red",
    "Saanen",
    "Alpine",
    "Anglo-Nubian",
    "Toggenburg",
    "Shami",
    "Crossbreed",
    "Unspecified",
  ],
  Sheep: [
    "Malin",
    "Dorper",
    "Blackbelly Barbados",
    "Damara",
    "Santa Ines",
    "Morada Nova",
    "Crossbreed",
    "Unspecified",
  ],
};

export const GENDERS = ["Male", "Female"];
export const LIVESTOCK_STATUSES = ["Available", "Reserved", "Sold", "Unavailable", "Draft"];
export const FARMER_LISTING_STATUSES = ["Available", "Unavailable", "Draft"];
export const LISTING_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export function listingExpiry(livestock, now = new Date()) {
  const explicitExpiry = Date.parse(livestock?.listingExpiresAt || "");
  const createdAt = Date.parse(livestock?.created_date || "");
  const expiresAt = Number.isFinite(explicitExpiry)
    ? explicitExpiry
    : Number.isFinite(createdAt) ? createdAt + LISTING_DURATION_MS : null;
  return {
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    expired: expiresAt !== null && expiresAt <= now.getTime(),
    daysRemaining: expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now.getTime()) / (24 * 60 * 60 * 1000))),
  };
}

export function newListingWindow(now = new Date()) {
  return {
    listingPublishedAt: now.toISOString(),
    listingExpiresAt: new Date(now.getTime() + LISTING_DURATION_MS).toISOString(),
  };
}

export function listingExpiryLabel(livestock) {
  const { expiresAt } = listingExpiry(livestock);
  if (!expiresAt) return "Renewal date unavailable";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(expiresAt);
}

// QURBI marketplace welfare thresholds based on post-weaning guidance.
// Cow: DVS guidance identifies weaned calves at >6 months or >100 kg.
// Sheep: DVS traceability guidance identifies 3 months as ruminant weaning age.
// Goat remains at the senior-approved, stricter 4-month marketplace rule.
// These are marketplace rules, not statutory sale limits or Qurban eligibility ages.
export const MIN_MARKETPLACE_AGE_MONTHS = {
  Cow: 6,
  Goat: 4,
  Sheep: 3,
};

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing Delivery",
  "Completed",
  "Cancelled",
];

export const DELIVERY_OPTIONS = [
  { value: "Self Delivery", label: "Own delivery", description: "I will arrange delivery to the buyer." },
  { value: "AISYAH Delivery", label: "QURBI delivery", description: "I want QURBI to arrange delivery." },
  { value: "Both", label: "Both options", description: "Delivery method can be decided per order." },
];

// Immutable identifiers saved with each signature for audit purposes.
// Publish a new identifier whenever the related policy wording changes.
export const FARMER_POLICY_VERSION = "farmer-registration-v1.1.0-2026-08-14";
export const SELLER_POLICY_VERSION = "seller-listing-v1.0.0-2026-08-13";

export const VERIFICATION_STATUSES = {
  "Not Submitted": { label: "Not Submitted", tone: "muted" },
  Pending: { label: "Pending Verification", tone: "warning" },
  Approved: { label: "Verified Farmer", tone: "success" },
  Rejected: { label: "Verification Rejected", tone: "danger" },
};

export function breedsFor(species, managedBreeds = []) {
  const defaults = BREEDS_BY_SPECIES[species] || [];
  const approved = managedBreeds
    .filter((breed) => breed.species === species && breed.status !== "Inactive")
    .map((breed) => breed.name)
    .filter(Boolean);
  return [...new Set([...defaults.filter((name) => name !== "Unspecified"), ...approved])]
    .sort((a, b) => a.localeCompare(b))
    .concat("Unspecified");
}

export function ageInMonths(livestock, today = new Date()) {
  if (livestock.ageInputMode === "Birth Date" && livestock.birthDate) {
    const birthDate = new Date(`${livestock.birthDate}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null;
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months += today.getMonth() - birthDate.getMonth();
    if (today.getDate() < birthDate.getDate()) months -= 1;
    return Math.max(0, months);
  }

  const value = Number(livestock.ageValue);
  if (!Number.isFinite(value) || value < 0) return null;
  const startingMonths = livestock.ageUnit === "Years" ? value * 12 : value;
  const recordedAt = livestock.ageRecordedAt ? new Date(`${livestock.ageRecordedAt}T00:00:00`) : today;
  if (Number.isNaN(recordedAt.getTime()) || recordedAt > today) return Math.round(startingMonths);
  let elapsed = (today.getFullYear() - recordedAt.getFullYear()) * 12;
  elapsed += today.getMonth() - recordedAt.getMonth();
  if (today.getDate() < recordedAt.getDate()) elapsed -= 1;
  return Math.max(0, Math.round(startingMonths + elapsed));
}

export function formatAge(livestock, today = new Date()) {
  const months = ageInMonths(livestock, today);
  if (months === null) return livestock.age || "—";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths
    ? `${years} year${years === 1 ? "" : "s"} ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`
    : `${years} year${years === 1 ? "" : "s"}`;
}

export function marketplaceVisibility(livestock) {
  if (["Pending", "Rejected"].includes(livestock.speciesApprovalStatus)) {
    return {
      visible: false,
      reason: livestock.speciesApprovalStatus === "Pending"
        ? "Species is waiting for superadmin approval"
        : "Species request was rejected",
    };
  }
  if (["Pending", "Rejected"].includes(livestock.breedApprovalStatus)) {
    return {
      visible: false,
      reason: livestock.breedApprovalStatus === "Pending"
        ? "Breed is waiting for superadmin approval"
        : "Breed request was rejected",
    };
  }
  if (livestock.status !== "Available") {
    return { visible: false, reason: `Status is ${livestock.status || "not available"}` };
  }
  if (listingExpiry(livestock).expired) {
    return { visible: false, reason: "Listing expired after 14 days; farmer confirmation is required" };
  }
  const months = ageInMonths(livestock);
  const minimum = MIN_MARKETPLACE_AGE_MONTHS[livestock.species];
  if (minimum && (months === null || months < minimum)) {
    return {
      visible: false,
      reason: months === null
        ? "Age could not be verified"
        : `Below the ${minimum}-month marketplace threshold`,
    };
  }
  return { visible: true, reason: "" };
}

export function marketplaceEligibleFrom(livestock) {
  const minimum = MIN_MARKETPLACE_AGE_MONTHS[livestock.species];
  if (!minimum) return "";
  let eligibilityDate;
  if (livestock.ageInputMode === "Birth Date" && livestock.birthDate) {
    eligibilityDate = new Date(`${livestock.birthDate}T00:00:00`);
    eligibilityDate.setMonth(eligibilityDate.getMonth() + minimum);
  } else {
    const value = Number(livestock.ageValue);
    if (!Number.isFinite(value) || value < 0) return "";
    const startingMonths = livestock.ageUnit === "Years" ? value * 12 : value;
    eligibilityDate = new Date(`${livestock.ageRecordedAt || new Date().toISOString().slice(0, 10)}T00:00:00`);
    eligibilityDate.setMonth(eligibilityDate.getMonth() + Math.max(0, minimum - startingMonths));
  }
  if (Number.isNaN(eligibilityDate.getTime())) return "";
  return eligibilityDate.toISOString().slice(0, 10);
}

export function formatMYR(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const number = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(number)) return "—";
  return `RM ${number.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function userVal(user, key) {
  if (!user) return undefined;
  return user.data?.[key] ?? user[key];
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
