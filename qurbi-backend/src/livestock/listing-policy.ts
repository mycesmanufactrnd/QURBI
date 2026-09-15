import { LivestockStatus, ReservationState } from '../entities';

export const LISTING_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
export const PAYMENT_RESERVATION_MS = 24 * 60 * 60 * 1000;

export function listingWindow(now = new Date()) {
  return {
    listingPublishedAt: now,
    listingExpiresAt: new Date(now.getTime() + LISTING_DURATION_MS),
  };
}

export function reservationWindow(now = new Date()) {
  return {
    reservationStartedAt: now,
    reservationExpiresAt: new Date(now.getTime() + PAYMENT_RESERVATION_MS),
  };
}

export function isListingExpired(
  listing: { listingExpiresAt?: Date | null },
  now = new Date(),
): boolean {
  return !listing.listingExpiresAt || listing.listingExpiresAt <= now;
}

export function hasActiveReservation(
  listing: {
    status?: LivestockStatus;
    reservationState?: ReservationState | null;
    reservationExpiresAt?: Date | null;
  },
  now = new Date(),
): boolean {
  return (
    listing.status === LivestockStatus.RESERVED &&
    listing.reservationState === ReservationState.ACTIVE &&
    Boolean(listing.reservationExpiresAt) &&
    (listing.reservationExpiresAt as Date) > now
  );
}
