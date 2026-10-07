// Build step 3 of 3 (see "build" in package.json). Takes the client build in
// dist/ and the server bundle in dist-ssr/, and writes:
//   - a prerendered index.html per public page (real content + <head> SEO tags)
//   - app-shell.html: the untouched empty app, served for private/dynamic routes
//   - sitemap.xml and robots.txt
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const env = loadEnv("production", root, "VITE_");
const siteUrl = (env.VITE_SITE_URL || "").replace(/\/+$/, "");
const indexing = env.VITE_ALLOW_INDEXING === "true";

// Guard: never ship a sitemap/robots that point at a placeholder or local URL.
if (indexing && !/^https:\/\/(?!localhost|your-domain)[^/\s]+\.[^/\s]+/i.test(siteUrl)) {
  throw new Error(
    `VITE_ALLOW_INDEXING=true needs a real https VITE_SITE_URL (got "${siteUrl || "empty"}"). ` +
      "Set VITE_SITE_URL to the production domain, or leave VITE_ALLOW_INDEXING unset.",
  );
}

const { render, PUBLIC_PATHS } = await import(
  pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href
);

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");

// 1) App shell for everything that is not prerendered: private routes keep
//    the `noindex` hint even before JavaScript runs. data-rh lets the app's
//    own <head> manager replace this tag instead of duplicating it.
const shell = template.replace("</head>", '    <meta data-rh="true" name="robots" content="noindex, nofollow" />\n  </head>');
fs.writeFileSync(path.join(dist, "app-shell.html"), shell);

// 2) Prerendered public pages
for (const route of PUBLIC_PATHS) {
  const { html, helmet } = render(route);
  const headTags = [
    helmet.title.toString(),
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
  ].join("\n    ");

  const page = template
    .replace(/<title>.*?<\/title>/s, "")
    .replace(/<html[^>]*>/, `<html ${helmet.htmlAttributes.toString()}>`)
    .replace("</head>", `    ${headTags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered>${html}</div>`);

  const outDir = route === "/" ? dist : path.join(dist, route.slice(1));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), page);
  console.log(`prerendered ${route}`);
}

// 3) sitemap.xml + robots.txt (indexing only when explicitly enabled)
const privatePaths = ["/auth", "/login", "/register", "/cart", "/payment", "/orders", "/transaction-history", "/history", "/profile", "/notifications", "/address-book", "/signup-details", "/user-agreement", "/switch-session", "/receipt", "/admin"];
if (indexing) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_PATHS.map((route) => {
    const loc = route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  }).join("\n");
  fs.writeFileSync(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  fs.writeFileSync(
    path.join(dist, "robots.txt"),
    `User-agent: *\nAllow: /\n${privatePaths.map((p) => `Disallow: ${p}`).join("\n")}\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
  console.log("indexing ENABLED: wrote sitemap.xml and robots.txt for", siteUrl);
} else {
  fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
  console.log("indexing DISABLED (set VITE_ALLOW_INDEXING=true on production): robots.txt blocks everything, no sitemap");
}
