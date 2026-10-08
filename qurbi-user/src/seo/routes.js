// Which URLs search engines may index, and the key of each one's text in the
// `seo` i18n namespace. This list drives the page <title>/description, the
// pre-rendered HTML files and sitemap.xml, so a new public page is added here
// (plus its text in locales/*/seo.json) and nowhere else.
//
// Everything NOT listed is treated as private/transactional: it gets
// `noindex` and is disallowed in robots.txt.
export const PUBLIC_PAGES = {
  "/": { key: "home" },
  "/browse": { key: "browse", breadcrumb: true },
  "/bulk-buy": { key: "bulkBuy", breadcrumb: true },
  "/privacy-policy": { key: "privacy", breadcrumb: true },
  "/terms-conditions": { key: "terms", breadcrumb: true },
  "/support": { key: "support", breadcrumb: true },
};

export const PUBLIC_PATHS = Object.keys(PUBLIC_PAGES);

// Public content, but one URL per animal/lot that sells or expires, so
// they are crawlable (`noindex, follow`) yet kept out of the index and sitemap.
export const DETAIL_PATH_PATTERN = /^\/(livestock|bulk-buy)\/[^/]+$/;

// Paths robots.txt should keep crawlers out of.
export const PRIVATE_PATHS = [
  "/auth",
  "/login",
  "/register",
  "/cart",
  "/payment",
  "/orders",
  "/transaction-history",
  "/history",
  "/profile",
  "/notifications",
  "/address-book",
  "/signup-details",
  "/user-agreement",
  "/switch-session",
  "/receipt",
  "/admin",
];

export function normalizePath(pathname = "/") {
  const clean = pathname.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}
