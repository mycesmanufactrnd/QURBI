// Proof photos are only accepted with a tight GPS fix. The backend enforces the
// same limit (COURIER_MAX_ACCURACY_M, default 100 m); checking it here too
// saves the courier from taking a photo that would be rejected.
export const MAX_ACCURACY_METERS = 100;

export const GEO_ERRORS = {
  unsupported: "unsupported",
  denied: "denied",
  unavailable: "unavailable",
  timeout: "timeout",
};

function toGeoError(error) {
  // GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout.
  const code = error?.code === 1 ? GEO_ERRORS.denied : error?.code === 3 ? GEO_ERRORS.timeout : GEO_ERRORS.unavailable;
  const wrapped = new Error(error?.message || code);
  wrapped.code = code;
  return wrapped;
}

/** One high-accuracy fix, or a rejected promise with `.code` from GEO_ERRORS. */
export function getPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error("Geolocation is not supported");
      error.code = GEO_ERRORS.unsupported;
      reject(error);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(readPosition(position)),
      (error) => reject(toGeoError(error)),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

/**
 * Keeps calling `onFix` as the GPS improves so the camera screen can show a
 * live accuracy reading. Returns a function that stops watching.
 */
export function watchPosition(onFix, onError) {
  if (!navigator.geolocation) {
    const error = new Error("Geolocation is not supported");
    error.code = GEO_ERRORS.unsupported;
    onError?.(error);
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (position) => onFix(readPosition(position)),
    (error) => onError?.(toGeoError(error)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

function readPosition(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

export const isAccurateEnough = (fix) => Boolean(fix) && fix.accuracy <= MAX_ACCURACY_METERS;

const REVERSE_GEOCODE_URL = (import.meta.env.VITE_REVERSE_GEOCODE_URL || "").replace(/\/$/, "");

/**
 * Turns coordinates into a street address for the stamp — only if the
 * deployment configures its own geocoder (VITE_REVERSE_GEOCODE_URL, expected
 * to answer `GET <url>?lat=..&lng=..` with `{ "address": "..." }`). Without it
 * the courier's coordinates are never sent to any third party, and the stamp
 * simply carries the coordinates. Never blocks the photo for more than a moment.
 */
export async function reverseGeocode(latitude, longitude, { timeout = 2500 } = {}) {
  if (!REVERSE_GEOCODE_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${REVERSE_GEOCODE_URL}?lat=${latitude}&lng=${longitude}`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.address === "string" ? data.address.slice(0, 200) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
