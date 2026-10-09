import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "qurbi_display_mode";
const VALID_MODES = new Set(["auto", "desktop", "mobile"]);

const DisplayModeContext = createContext({
  displayMode: "auto",
  effectiveMode: "mobile",
  isDesktop: false,
  sidebarExpanded: false,
  sidebarWidth: 88,
  setDisplayMode: (_mode) => {},
  setSidebarExpanded: (_expanded) => {},
});

export function DisplayModeProvider({ children }) {
  const [displayMode, setDisplayModeState] = useState("auto");
  const [viewportDesktop, setViewportDesktop] = useState(false);
  const [sidebarExpanded, setSidebarExpandedState] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setViewportDesktop(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);

    try {
      const savedMode = window.localStorage.getItem(STORAGE_KEY);
      if (VALID_MODES.has(savedMode)) setDisplayModeState(savedMode);
    } catch {
      // The app still follows Auto when storage is unavailable.
    }

    return () => mediaQuery.removeEventListener?.("change", updateViewport);
  }, []);

  const setSidebarExpanded = useCallback((expanded) => {
    setSidebarExpandedState(Boolean(expanded));
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
  const sidebarWidth = sidebarExpanded ? 260 : 88;

  useEffect(() => {
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
      sidebarExpanded,
      sidebarWidth,
      setSidebarExpanded,
    }),
    [
      displayMode,
      effectiveMode,
      isDesktop,
      setDisplayMode,
      setSidebarExpanded,
      sidebarExpanded,
      sidebarWidth,
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
