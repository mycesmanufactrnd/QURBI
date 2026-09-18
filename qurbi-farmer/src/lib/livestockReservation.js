import { base44 } from "@/api/base44Client";

export function hasActivePaymentReservation(livestock, now = new Date()) {
  const expiresAt = Date.parse(livestock?.reservationExpiresAt || "");
  return livestock?.reservationState === "Active"
    && livestock?.status === "Reserved"
    && Number.isFinite(expiresAt)
    && expiresAt > now.getTime();
}

export function reservationExpiryLabel(livestock) {
  if (!hasActivePaymentReservation(livestock)) return "";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(livestock.reservationExpiresAt));
}

export async function refreshExpiredReservations(items) {
  const candidates = (items || []).filter((item) => (
    item.status === "Reserved" && item.reservationState === "Active"
  ));
  if (!candidates.length) return items || [];
  await Promise.allSettled(candidates.map((item) => (
    base44.functions.invoke("checkLivestockReservation", { livestockId: item.id })
  )));
  return base44.entities.Livestock.list("-created_date", 500);
}
