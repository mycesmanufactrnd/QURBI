// Base44 timestamps are UTC. Older Base44 records omit the trailing `Z`, so
// JavaScript would otherwise interpret them in the browser's timezone. Normalize
// only that timezone-less storage format to a UTC instant, then let Intl perform
// the Malaysia-time conversion for every display and day grouping.
const ZONE = "Asia/Kuala_Lumpur";
const TIMEZONE_LESS_BASE44_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

export const parseBase44Timestamp = (value) => {
  if (value instanceof Date) return value;
  const timestamp = String(value || "").trim();
  return new Date(TIMEZONE_LESS_BASE44_TIMESTAMP.test(timestamp) ? `${timestamp}Z` : timestamp);
};

const parts = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(parseBase44Timestamp(value)).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
const dateKey = ({ year, month, day }) => `${year}-${month}-${day}`;

export const orderDateKey = (createdDate) => dateKey(parts(createdDate));
export const orderTimestamp = (createdDate) => parseBase44Timestamp(createdDate).getTime();
export const formatOrderDate = (createdDate, options = {}) => new Intl.DateTimeFormat("en-MY", { timeZone: ZONE, day: "numeric", month: "short", year: "numeric", ...options }).format(parseBase44Timestamp(createdDate));
export const formatOrderTime = (createdDate) => new Intl.DateTimeFormat("en-MY", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(parseBase44Timestamp(createdDate));
export const formatOrderDateTime = (createdDate) => new Intl.DateTimeFormat("en-MY", { timeZone: ZONE, day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(parseBase44Timestamp(createdDate));
export const orderDayHeading = (createdDate) => {
  const key = orderDateKey(createdDate);
  const todayParts = parts(new Date());
  const today = dateKey(todayParts);
  const yesterdayDate = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day) - 1));
  const yesterday = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getUTCDate()).padStart(2, "0")}`;
  if (key === today) return "Today"; if (key === yesterday) return "Yesterday";
  return formatOrderDate(createdDate, { month: "long" });
};
