import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "qurbi_display_mode";
const VALID_MODES = new Set(["auto", "desktop", "mobile"]);
const DESKTOP_QUERY = "(min-width: 1024px)";
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readSavedMode() {
  if (typeof window === "undefined") return "auto";
  try {
    const savedMode = window.localStorage.getItem(STORAGE_KEY);
    return VALID_MODES.has(savedMode) ? savedMode : "auto";
  } catch {
    return "auto";
  }
}

function readViewportDesktop() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}

const DisplayModeContext = createContext({
  displayMode: "auto",
  effectiveMode: "mobile",
  isDesktop: false,
  setDisplayMode: (_mode) => {},
});

export function DisplayModeProvider({ children }) {
  // Match the server-rendered shell during hydration, then restore the saved
  // preference in a layout effect (before paint). The previous normal effect
  // visibly rendered the opposite layout for one frame after refresh.
  const [displayMode, setDisplayModeState] = useState("auto");
  const [viewportDesktop, setViewportDesktop] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setDisplayModeState(readSavedMode());
    setViewportDesktop(readViewportDesktop());
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const updateViewport = () => setViewportDesktop(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);

    return () => mediaQuery.removeEventListener?.("change", updateViewport);
  }, []);

  const setDisplayMode = useCallback((nextMode) => {
    if (!VALID_MODES.has(nextMode)) return;
    setDisplayModeState(nextMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Keep the in-memory choice for this session.
    }
  }, []);

  const effectiveMode =
    displayMode === "auto"
      ? viewportDesktop
        ? "desktop"
        : "mobile"
      : displayMode;
  const isDesktop = effectiveMode === "desktop";

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.qurbiDisplayPreference = displayMode;
    root.dataset.qurbiDisplayMode = effectiveMode;
    return () => {
      delete root.dataset.qurbiDisplayPreference;
      delete root.dataset.qurbiDisplayMode;
    };
  }, [displayMode, effectiveMode]);

  const value = useMemo(
    () => ({
      displayMode,
      effectiveMode,
      isDesktop,
      setDisplayMode,
    }),
    [
      displayMode,
      effectiveMode,
      isDesktop,
      setDisplayMode,
    ],
  );

  return (
    <DisplayModeContext.Provider value={value}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
