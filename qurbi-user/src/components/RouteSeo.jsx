import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  INDEXING_ENABLED,
  LOGO_PATH,
  OG_IMAGE_PATH,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/seo/site";
import { DETAIL_PATH_PATTERN, PUBLIC_PAGES, normalizePath } from "@/seo/routes";

/**
 * Writes the <head> metadata for whichever route is showing: title,
 * description, canonical, robots, Open Graph, Twitter card and JSON-LD.
 * Text comes from the `seo` namespace, so it follows the chosen language.
 * Rendered once, in the app root; pages do not need their own SEO code.
 */
export default function RouteSeo() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation("seo");
  const path = normalizePath(pathname);
  const page = PUBLIC_PAGES[path];
  const isDetail = DETAIL_PATH_PATTERN.test(path);
  const lang = i18n.language === "en" ? "en" : "ms";

  const title = page ? t(`${page.key}.title`) : t("default.title");
  const description = page ? t(`${page.key}.description`) : t("default.description");
  const canonical = page ? absoluteUrl(path) : "";

  let robots = "noindex, nofollow";
  if (page && INDEXING_ENABLED) robots = "index, follow, max-image-preview:large";
  else if (isDetail) robots = "noindex, follow";

  const image = SITE_URL ? `${SITE_URL}${OG_IMAGE_PATH}` : OG_IMAGE_PATH;
  const jsonLd = [];
  if (page && SITE_URL) {
    if (path === "/") {
      jsonLd.push(
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: absoluteUrl("/"),
          logo: `${SITE_URL}${LOGO_PATH}`,
          description: t("organization.description"),
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
          inLanguage: lang === "ms" ? "ms-MY" : "en-MY",
        },
      );
    } else if (page.breadcrumb) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("home.breadcrumb"), item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: t(`${page.key}.breadcrumb`), item: absoluteUrl(path) },
        ],
      });
    }
  }

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      {canonical && <link rel="canonical" href={canonical} />}
      {page && <meta property="og:type" content="website" />}
      {page && <meta property="og:site_name" content={SITE_NAME} />}
      {page && <meta property="og:title" content={title} />}
      {page && <meta property="og:description" content={description} />}
      {page && canonical && <meta property="og:url" content={canonical} />}
      {page && <meta property="og:image" content={image} />}
      {page && <meta property="og:image:width" content="1200" />}
      {page && <meta property="og:image:height" content="630" />}
      {page && <meta property="og:image:alt" content={t("default.imageAlt")} />}
      {page && <meta property="og:locale" content={lang === "ms" ? "ms_MY" : "en_US"} />}
      {page && <meta name="twitter:card" content="summary_large_image" />}
      {page && <meta name="twitter:title" content={title} />}
      {page && <meta name="twitter:description" content={description} />}
      {page && <meta name="twitter:image" content={image} />}
      {jsonLd.map((data) => (
        <script key={data["@type"]} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
}
