// Single source of truth for the site's public address and indexing switch.
//
// VITE_SITE_URL       production origin, e.g. https://qurbi.my (no trailing slash needed)
// VITE_ALLOW_INDEXING "true" only on the real production site. Anything else
//                     (staging, *.netlify.app previews, local) tells search
//                     engines to stay out, so a test deploy can never be indexed.

export const SITE_NAME = "QURBI";
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
export const INDEXING_ENABLED = import.meta.env.VITE_ALLOW_INDEXING === "true";

export const OG_IMAGE_PATH = "/og-image.png";
export const LOGO_PATH = "/logo.png";

/** Absolute URL for a path, or "" when no site URL is configured (local dev). */
export function absoluteUrl(path = "/") {
  if (!SITE_URL) return "";
  return `${SITE_URL}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
}
