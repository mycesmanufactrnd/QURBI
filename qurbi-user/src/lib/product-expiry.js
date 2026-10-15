const LISTING_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export function listingExpiryTime(product) {
  const expiryValue =
    product?.marketplaceExpiresAt ??
    product?.marketplace_expires_at ??
    product?.listingExpiresAt ??
    product?.listing_expires_at;

  if (expiryValue) {
    const explicitExpiry = Date.parse(expiryValue);
    return Number.isFinite(explicitExpiry) ? explicitExpiry : Number.NaN;
  }

  const createdAt = Date.parse(product?.created_date || "");
  return Number.isFinite(createdAt)
    ? createdAt + LISTING_LIFETIME_MS
    : Number.NaN;
}

export function isProductExpired(product, now = Date.now()) {
  if (String(product?.status || "").trim().toLowerCase() === "expired") {
    return true;
  }
  const expiry = listingExpiryTime(product);
  return Number.isFinite(expiry) && expiry <= now;
}

