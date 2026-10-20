// Display + deep-link helpers shared by the courier screens.

const MYT = "Asia/Kuala_Lumpur";

const MONEY = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "RM 15.00". Money is always shown with sen so totals line up. */
export function formatMoney(amount) {
  const number = Number(amount);
  return Number.isFinite(number) ? `RM ${MONEY.format(number)}` : "—";
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Dates are always shown in Malaysia time, the same zone the proof photos are
// stamped in, so what the courier sees matches what is printed on the photo.
export function formatDate(value, locale = "en-MY") {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale, { timeZone: MYT, day: "numeric", month: "short", year: "numeric" }).format(date) : "—";
}

export function formatDateTime(value, locale = "en-MY") {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, { timeZone: MYT, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date)
    : "—";
}

/** "5 minutes ago" / "5 minit lalu" in the app language — short, for "job ready" labels. */
export function timeAgo(value, locale = "en", now = Date.now()) {
  const date = toDate(value);
  if (!date) return "";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60000));
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}

/** Keeps only digits; Malaysian numbers starting 0 become +60 for tel:/wa.me links. */
export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

export const telLink = (phone) => {
  const digits = normalizePhone(phone);
  return digits ? `tel:+${digits}` : "";
};

export const whatsappLink = (phone, text) => {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

/** One-tap navigation: coordinates when known (exact), otherwise the address text. */
export function mapsLink({ latitude, longitude, address }) {
  const hasCoords = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number(latitude) !== 0;
  const destination = hasCoords ? `${latitude},${longitude}` : address;
  if (!destination) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function wazeLink({ latitude, longitude, address }) {
  const hasCoords = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number(latitude) !== 0;
  if (hasCoords) return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
  return address ? `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes` : "";
}

export const joinAddress = (...parts) => parts.filter(Boolean).join(", ");

export function errorText(error, t) {
  if (error?.isNetworkError) return t("errors.network", { ns: "common" });
  return error?.message || t("errors.generic", { ns: "common" });
}
