// Shared domain constants for QURBI Farmer.
import i18n from "@/i18n";

// Display text below is resolved lazily (getters / functions) so it follows the
// language the farmer picks without a reload. Stored values never change.
const tr = (key, options) => i18n.t(`agri:${key}`, options);
const dateLocale = () => (i18n.language === "ms" ? "ms-MY" : "en-MY");

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
  if (!expiresAt) return tr("renewalUnavailable");
  return new Intl.DateTimeFormat(dateLocale(), { day: "numeric", month: "short", year: "numeric" }).format(expiresAt);
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
  { value: "Self Delivery", get label() { return tr("delivery.self.label"); }, get description() { return tr("delivery.self.description"); } },
  { value: "AISYAH Delivery", get label() { return tr("delivery.qurbi.label"); }, get description() { return tr("delivery.qurbi.description"); } },
  { value: "Both", get label() { return tr("delivery.both.label"); }, get description() { return tr("delivery.both.description"); } },
];

// Immutable identifiers saved with each signature for audit purposes.
// Publish a new identifier whenever the related policy wording changes.
export const FARMER_POLICY_VERSION = "farmer-registration-v1.1.0-2026-08-14";
export const SELLER_POLICY_VERSION = "seller-listing-v1.0.0-2026-08-13";

export const VERIFICATION_STATUSES = {
  "Not Submitted": { get label() { return tr("verification.notSubmitted"); }, tone: "muted" },
  Pending: { get label() { return tr("verification.pending"); }, tone: "warning" },
  Approved: { get label() { return tr("verification.approved"); }, tone: "success" },
  Rejected: { get label() { return tr("verification.rejected"); }, tone: "danger" },
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
  if (months < 12) return tr("age.month", { count: months });
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths
    ? `${tr("age.year", { count: years })} ${tr("age.month", { count: remainingMonths })}`
    : tr("age.year", { count: years });
}

export function marketplaceVisibility(livestock) {
  if (["Pending", "Rejected"].includes(livestock.speciesApprovalStatus)) {
    return {
      visible: false,
      reason: livestock.speciesApprovalStatus === "Pending"
        ? tr("visibility.speciesPending")
        : tr("visibility.speciesRejected"),
    };
  }
  if (["Pending", "Rejected"].includes(livestock.breedApprovalStatus)) {
    return {
      visible: false,
      reason: livestock.breedApprovalStatus === "Pending"
        ? tr("visibility.breedPending")
        : tr("visibility.breedRejected"),
    };
  }
  if (livestock.status !== "Available") {
    return { visible: false, reason: tr("visibility.status", { status: livestock.status ? tr(`livestockStatus.${livestock.status}`, { defaultValue: livestock.status }) : tr("visibility.notAvailable") }) };
  }
  if (listingExpiry(livestock).expired) {
    return { visible: false, reason: tr("visibility.expired") };
  }
  const months = ageInMonths(livestock);
  const minimum = MIN_MARKETPLACE_AGE_MONTHS[livestock.species];
  if (minimum && (months === null || months < minimum)) {
    return {
      visible: false,
      reason: months === null
        ? tr("visibility.ageUnknown")
        : tr("visibility.belowThreshold", { minimum }),
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
  // Show sen only when it is not zero: RM 8,500 but RM 8,500.50.
  const hasSen = Math.round(Math.abs(number) * 100) % 100 !== 0;
  return `RM ${number.toLocaleString("en-MY", { minimumFractionDigits: hasSen ? 2 : 0, maximumFractionDigits: 2 })}`;
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

// ---------------------------------------------------------------------------
// Display helpers (names, dates, statuses). One mapping per status family so
// every screen shows the same friendly label and colour.
// ---------------------------------------------------------------------------

/** "pending_payment" / "PENDING" -> "Pending payment". */
export function humanize(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const HONORIFICS = new Set([
  "haji", "hajah", "hj", "hj.", "hjh", "hjh.", "dato", "dato'", "datuk", "datin", "dr", "dr.", "tuan", "puan",
  "encik", "en.", "cik", "ustaz", "ustazah", "tan", "sri", "seri", "tengku", "ir", "ir.", "prof", "prof.",
]);
const PATRONYMIC = new Set(["bin", "binti", "bt", "bt.", "b.", "bte", "a/l", "a/p", "s/o", "d/o"]);

/**
 * Friendly short name for greetings. Keeps one leading honorific together with
 * the given name, so "Haji Salleh bin Ismail" becomes "Haji Salleh" (never just "Haji").
 * @param {string} [fullName]
 */
export function shortName(fullName = "") {
  const words = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const cut = words.findIndex((word, index) => index > 0 && PATRONYMIC.has(word.toLowerCase()));
  const given = cut > 0 ? words.slice(0, cut) : words;
  let start = 0;
  while (start < given.length - 1 && HONORIFICS.has(given[start].toLowerCase())) start += 1;
  const honorific = given.slice(0, Math.min(start, 1));
  const rest = given.slice(start);
  const core = cut > 0 ? rest.slice(0, 2) : rest.slice(0, rest.length <= 2 ? rest.length : 1);
  return [...honorific, ...core].join(" ");
}

/** Best display name for a signed-in user: full name, then email, then "Farmer". */
export function displayName(user) {
  return userVal(user, "name") || user?.full_name || user?.fullName || user?.email?.split("@")[0] || tr("farmerFallback");
}

const dateFormat = () => new Intl.DateTimeFormat(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = () => new Intl.DateTimeFormat(dateLocale(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** "30 Sep 2026" (or fallback). */
export function formatDate(value, fallback = "—") {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? dateFormat().format(new Date(time)) : fallback;
}

/** "30 Sep 2026, 1:39 am" (or fallback). */
export function formatDateTime(value, fallback = "—") {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? dateTimeFormat().format(new Date(time)) : fallback;
}

/** "5 min ago", "3 h ago", "Yesterday", else a friendly date. */
export function formatRelative(value, now = new Date()) {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return "";
  const minutes = Math.round((now.getTime() - time) / 60000);
  if (minutes < 1) return tr("relative.justNow");
  if (minutes < 60) return tr("relative.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tr("relative.hoursAgo", { count: hours });
  if (hours < 48) return tr("relative.yesterday");
  return formatDate(value);
}

// Livestock (single animal) statuses as normalised by qurbiClient ("Available", ...).
export const LIVESTOCK_STATUS_META = {
  Available: { get label() { return tr("livestockStatus.Available"); }, tone: "success" },
  Reserved: { get label() { return tr("livestockStatus.Reserved"); }, tone: "warning" },
  Sold: { get label() { return tr("livestockStatus.Sold"); }, tone: "muted" },
  Unavailable: { get label() { return tr("livestockStatus.Unavailable"); }, tone: "muted" },
  Draft: { get label() { return tr("livestockStatus.Draft"); }, tone: "info" },
  Sick: { get label() { return tr("livestockStatus.Sick"); }, tone: "danger" },
  Expired: { get label() { return tr("livestockStatus.Expired"); }, tone: "danger" },
};

/**
 * Label + tone for a livestock listing status. Pass the listing to detect an
 * expired (Available but past its 14-day window) listing.
 * @param {string} status
 * @param {any} [livestock]
 * @returns {{ label: string, tone: string }}
 */
export function livestockStatusMeta(status, livestock) {
  if (livestock && status === "Available" && listingExpiry(livestock).expired) return LIVESTOCK_STATUS_META.Expired;
  return LIVESTOCK_STATUS_META[status] || { label: humanize(status) || tr("unknown"), tone: "muted" };
}

export const BULK_STATUS_META = {
  Available: { get label() { return tr("bulkStatus.Available"); }, tone: "success" },
  Open: { get label() { return tr("bulkStatus.Open"); }, tone: "success" },
  Paused: { get label() { return tr("bulkStatus.Paused"); }, tone: "warning" },
  Draft: { get label() { return tr("bulkStatus.Draft"); }, tone: "info" },
  Sold: { get label() { return tr("bulkStatus.Sold"); }, tone: "muted" },
  Cancelled: { get label() { return tr("bulkStatus.Cancelled"); }, tone: "muted" },
};

/** @param {string} status @returns {{ label: string, tone: string }} */
export function bulkStatusMeta(status) {
  return BULK_STATUS_META[status] || { label: humanize(status) || tr("unknown"), tone: "muted" };
}

// Order statuses as normalised by qurbiClient (pending_payment -> "pending",
// preparing -> "processing", in_transit -> "shipped", received -> "completed").
// `group` drives filters and counts; `next` is the farmer's next step.
export const ORDER_STATUS_META = {
  pending: { get label() { return tr("orderStatus.awaitingPayment"); }, tone: "muted", group: "payment", get next() { return tr("orderStatus.nextPayment"); } },
  pending_payment: { get label() { return tr("orderStatus.awaitingPayment"); }, tone: "muted", group: "payment", get next() { return tr("orderStatus.nextPayment"); } },
  paid: { get label() { return tr("orderStatus.toPrepare"); }, tone: "info", group: "action", get next() { return tr("orderStatus.nextBefore"); } },
  to_ship: { get label() { return tr("orderStatus.toPrepare"); }, tone: "info", group: "action", get next() { return tr("orderStatus.nextBefore"); } },
  processing: { get label() { return tr("orderStatus.preparing"); }, tone: "primary", group: "action", get next() { return tr("orderStatus.nextDuring"); } },
  preparing: { get label() { return tr("orderStatus.preparing"); }, tone: "primary", group: "action", get next() { return tr("orderStatus.nextDuring"); } },
  shipped: { get label() { return tr("orderStatus.onTheWay"); }, tone: "warning", group: "action", get next() { return tr("orderStatus.nextAfter"); } },
  in_transit: { get label() { return tr("orderStatus.onTheWay"); }, tone: "warning", group: "action", get next() { return tr("orderStatus.nextAfter"); } },
  to_receive: { get label() { return tr("orderStatus.onTheWay"); }, tone: "warning", group: "action", get next() { return tr("orderStatus.nextAfter"); } },
  delivering: { get label() { return tr("orderStatus.onTheWay"); }, tone: "warning", group: "action", get next() { return tr("orderStatus.nextAfter"); } },
  delivered: { get label() { return tr("orderStatus.delivered"); }, tone: "success", group: "buyer", get next() { return tr("orderStatus.nextDelivered"); } },
  completed: { get label() { return tr("orderStatus.completed"); }, tone: "success", group: "done", get next() { return tr("orderStatus.nextCompleted"); } },
  received: { get label() { return tr("orderStatus.completed"); }, tone: "success", group: "done", get next() { return tr("orderStatus.nextCompleted"); } },
  cancelled: { get label() { return tr("orderStatus.cancelled"); }, tone: "muted", group: "closed", get next() { return tr("orderStatus.nextCancelled"); } },
  return_requested: { get label() { return tr("orderStatus.returnRequested"); }, tone: "danger", group: "issue", get next() { return tr("orderStatus.nextReturn"); } },
  refund_requested: { get label() { return tr("orderStatus.refundRequested"); }, tone: "danger", group: "issue", get next() { return tr("orderStatus.nextRefundRequested"); } },
  return_refund: { get label() { return tr("orderStatus.returnRefund"); }, tone: "danger", group: "issue", get next() { return tr("orderStatus.nextReturnRefund"); } },
  refunded: { get label() { return tr("orderStatus.refunded"); }, tone: "muted", group: "closed", get next() { return tr("orderStatus.nextRefunded"); } },
};

/** @param {string} status @returns {{ label: string, tone: string, group: string, next: string }} */
export function orderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: humanize(status) || tr("unknown"), tone: "muted", group: "other", next: "" };
}

/** Farmer photo stage expected next for this order status ("before" | "during" | "after" | ""). */
export function orderPhotoStage(status) {
  if (["paid", "to_ship"].includes(status)) return "before";
  if (["processing", "preparing"].includes(status)) return "during";
  if (["shipped", "in_transit", "to_receive", "delivering"].includes(status)) return "after";
  return "";
}

export const PAYMENT_STATUS_LABELS = {
  get paid() { return tr("paymentStatus.paid"); },
  get unpaid() { return tr("paymentStatus.unpaid"); },
  get pending() { return tr("paymentStatus.unpaid"); },
  get failed() { return tr("paymentStatus.failed"); },
  get refunded() { return tr("paymentStatus.refunded"); },
  get partially_refunded() { return tr("paymentStatus.partiallyRefunded"); },
};
export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[String(status || "").toLowerCase()] || humanize(status) || "—";
}

/** Name for an order line: listing title first, breed only when it is meaningful. */
export function orderItemTitle(item) {
  const title = item?.titleSnapshot || item?.species || tr("livestock");
  const candidateBreed = item?.breed && !/^unspecified/i.test(item.breed) ? item.breed : "";
  const normalizeName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedTitle = normalizeName(title);
  const normalizedBreed = normalizeName(candidateBreed);
  // Generated snapshots already read like "Goat - Shami". Do not repeat
  // "Shami" as a second line, but preserve it for custom titles that omit it.
  const breed = normalizedBreed && !normalizedTitle.includes(normalizedBreed) ? candidateBreed : "";
  return { title, breed };
}

/** Listing title if the farmer gave one, otherwise the breed or species. */
export function livestockTitle(livestock) {
  const breed = livestock?.breed && livestock.breed !== "Unspecified" ? livestock.breed : "";
  const generated = [livestock?.species, breed].filter(Boolean).join(" - ");
  const title = livestock?.title && livestock.title !== generated ? livestock.title : "";
  return title || breed || livestock?.species || tr("livestock");
}

/**
 * Home dashboard numbers from real orders + listings.
 * - active: listings buyers can see now (for sale and not expired).
 * - toHandle: paid orders waiting on the farmer (prepare / on the way).
 * - awaitingPayment: orders placed but not yet paid.
 * - sold: animals sold (listing marked Sold, or on a delivered/completed order).
 */
export function farmStats(orders = [], livestock = []) {
  const toHandle = orders.filter((order) => orderStatusMeta(order.status).group === "action").length;
  const awaitingPayment = orders.filter((order) => orderStatusMeta(order.status).group === "payment").length;
  const soldIds = new Set(livestock.filter((item) => item.status === "Sold").map((item) => item.id));
  let soldWithoutId = 0;
  for (const order of orders) {
    if (!["buyer", "done"].includes(orderStatusMeta(order.status).group)) continue;
    for (const item of order.items || []) {
      const id = item.livestock_id || item.livestockId;
      if (id) soldIds.add(id);
      else soldWithoutId += Number(item.quantity || 1);
    }
  }
  const active = livestock.filter((item) => item.status === "Available" && !item.disabled && !listingExpiry(item).expired).length;
  return { active, toHandle, awaitingPayment, sold: soldIds.size + soldWithoutId };
}
