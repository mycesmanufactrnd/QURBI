import { LivestockStatus, ReservationState } from '../entities';
import {
  hasActiveReservation,
  isListingExpired,
  listingWindow,
  LISTING_DURATION_MS,
  PAYMENT_RESERVATION_MS,
  reservationWindow,
} from './listing-policy';

const now = new Date('2026-09-15T00:00:00.000Z');

describe('livestock listing policy', () => {
  it('publishes a new listing for exactly 14 days', () => {
    const window = listingWindow(now);
    expect(window.listingExpiresAt.getTime() - now.getTime()).toBe(
      LISTING_DURATION_MS,
    );
    expect(isListingExpired(window, window.listingExpiresAt)).toBe(true);
  });

  it('creates a payment reservation for exactly 24 hours', () => {
    const window = reservationWindow(now);
    expect(window.reservationExpiresAt.getTime() - now.getTime()).toBe(
      PAYMENT_RESERVATION_MS,
    );
    expect(
      hasActiveReservation(
        {
          status: LivestockStatus.RESERVED,
          reservationState: ReservationState.ACTIVE,
          reservationExpiresAt: window.reservationExpiresAt,
        },
        now,
      ),
    ).toBe(true);
  });

  it('treats a missing expiry as unavailable instead of exposing it forever', () => {
    expect(isListingExpired({ listingExpiresAt: null }, now)).toBe(true);
  });
});
