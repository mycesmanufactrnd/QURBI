# SEO and static generation (buyer app)

The buyer app is a Vite + React single-page app. `npm run build` now also
**prerenders the public pages to real HTML** so search engines and social
previews see the content without running JavaScript.

```
npm run build   =  vite build                      (client bundle -> dist/)
                +  vite build --ssr ...            (server bundle -> dist-ssr/)
                +  node scripts/prerender.mjs      (HTML pages, sitemap, robots)
```

## What is what

| URL | How it is served | Indexed? |
|---|---|---|
| `/`, `/browse`, `/bulk-buy`, `/privacy-policy`, `/terms-conditions`, `/support` | **SSG** - prerendered HTML (listings on Browse/Home are filled in by the browser from the API) | Yes (when indexing is enabled) |
| `/livestock/:id`, `/bulk-buy/:id` | **CSR** - app shell, then API data | No (`noindex, follow`) - one URL per animal, changes and expires |
| `/cart`, `/payment`, `/orders`, `/history`, `/profile`, `/notifications`, `/address-book`, `/auth`, ... | **CSR** - app shell | No (`noindex, nofollow`, blocked in robots.txt) |

## Environment variables (set in Netlify > Site settings > Environment)

| Variable | Value |
|---|---|
| `VITE_SITE_URL` | The public https origin, e.g. `https://qurbi.my` (no path) |
| `VITE_ALLOW_INDEXING` | `true` **only on the real production site**. Leave unset on previews / `*.netlify.app` so nothing gets indexed. |
| `VITE_API_BASE_URL` | The deployed backend API, e.g. `https://api.qurbi.my/api` |

With `VITE_ALLOW_INDEXING` unset, every page is `noindex`, robots.txt is
`Disallow: /` and no sitemap is written. With it set, the build **fails** unless
`VITE_SITE_URL` is a real https domain (not localhost or the placeholder).

## Adding a new public page

1. Add the route in `src/App.jsx` as usual.
2. Add it to `PUBLIC_PAGES` in `src/seo/routes.js`.
3. Add its `title`, `description` and `breadcrumb` under the same key in
   `src/i18n/locales/ms/seo.json` and `.../en/seo.json`.
4. Use one `<h1>` and wrap the page in `<main>`.

The title, description, canonical, Open Graph, Twitter card, JSON-LD, sitemap
entry and prerendered file all come from those two places - no per-page SEO code.

Anything **not** in `PUBLIC_PAGES` is automatically `noindex`.

## Rules for code that runs during the prerender

Pages in `PUBLIC_PAGES` are rendered in Node, where there is no `window`,
`document` or `localStorage`. Keep that access inside `useEffect`, or behind
`typeof window !== "undefined"`. Browser-only UI (portals, splash screens)
should wait for `useMounted()` (`src/hooks/useMounted.js`) so the first client
render matches the prerendered HTML.
