import { useEffect } from "react";

export const DEFAULT_PAGE_REFRESH_MS = 45_000;

/**
 * Refresh page data while it is useful to the user without polling hidden tabs.
 * The supplied callback is responsible for preventing overlapping requests.
 */
export function useVisiblePageRefresh(
  refresh,
  { intervalMs = DEFAULT_PAGE_REFRESH_MS } = {},
) {
  useEffect(() => {
    refresh({ silent: false });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh({ silent: true });
      }
    };

    const interval = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs, refresh]);
}
