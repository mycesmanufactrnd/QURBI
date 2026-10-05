import { useEffect, useState } from "react";

/**
 * False on the server and during hydration, true after the first client
 * effect. Browser-only UI (portals, splash screens) waits for this so the
 * first client render matches the prerendered HTML exactly.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
