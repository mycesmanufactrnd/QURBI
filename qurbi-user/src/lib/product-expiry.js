const LISTING_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export function listingExpiryTime(product) {
  if (product?.listingExpiresAt) {
    const explicitExpiry = Date.parse(product.listingExpiresAt);
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

