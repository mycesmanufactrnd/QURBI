import { useEffect, useMemo, useState } from "react";
import apiClient from "@/api/apiClient";

// Courier proof photos are private uploads: they can only be fetched with the
// buyer's access token, so a plain <img src> would show a broken image. These
// helpers download them into blob urls instead.

const PRIVATE_MARKER = "/uploads/private/";

/** The API-relative path of a private upload, or "" for any other url. */
export function privatePath(url) {
  if (typeof url !== "string") return "";
  const at = url.indexOf(PRIVATE_MARKER);
  return at === -1 ? "" : url.slice(at);
}

/**
 * Downloads each private url once and returns { [url]: blobUrl }.
 * Urls that are not private (or still loading) are simply absent from the map.
 * @param {string[]} urls
 */
export function usePrivateImageUrls(urls) {
  const key = useMemo(() => [...new Set(urls.filter((url) => privatePath(url)))].sort().join("\n"), [urls]);
  const [resolved, setResolved] = useState({});

  useEffect(() => {
    const wanted = key ? key.split("\n") : [];
    let cancelled = false;
    const created = [];
    setResolved({});
    wanted.forEach((url) => {
      apiClient.get(privatePath(url), { responseType: "blob" })
        .then((response) => {
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(response.data);
          created.push(objectUrl);
          setResolved((current) => ({ ...current, [url]: objectUrl }));
        })
        .catch(() => { /* the image just stays unavailable */ });
    });
    return () => {
      cancelled = true;
      created.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [key]);

  return resolved;
}

/**
 * Takes the { stage: { image_url } } map the order screen already uses and
 * returns it with every private image swapped for a displayable blob url.
 * A stage whose private image has not loaded yet has an empty image_url, so
 * the screen shows its normal "no photo yet" state instead of a broken image.
 * @param {Record<string, { image_url?: string }>} photos
 */
export function useResolvedPhotos(photos) {
  const urls = useMemo(() => Object.values(photos || {}).map((photo) => photo?.image_url).filter(Boolean), [photos]);
  const resolved = usePrivateImageUrls(urls);
  return useMemo(() => Object.fromEntries(
    Object.entries(photos || {}).map(([stage, photo]) => {
      if (!photo?.image_url || !privatePath(photo.image_url)) return [stage, photo];
      return [stage, { ...photo, image_url: resolved[photo.image_url] || "" }];
    }),
  ), [photos, resolved]);
}
