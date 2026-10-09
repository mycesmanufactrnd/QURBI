import React from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/useMounted";
import { useDisplayMode } from "@/lib/display-mode-context";

const TONES = {
  // Cream bar: stands out on the dark detail sheets.
  light: "border-[#41362D]/25 bg-gradient-to-br from-[#F7EDE2] to-[#E3C19F] text-[#41362D]",
  // Taupe bar: stands out on the cream list pages (cart, checkout).
  dark: "border-[#E3C19F]/40 bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white",
};

/**
 * Primary-action bar pinned just above the bottom navigation. Pages that use
 * it add the `qurbi-action-bar-space` class (index.css) to their page wrapper
 * so the last content is never hidden behind the bar + nav.
 * @param {{ children: React.ReactNode, tone?: "light" | "dark", label?: string, className?: string }} props
 */
export default function StickyActionBar({ children, tone = "dark", label, className = "" }) {
  const mounted = useMounted();
  const { isDesktop, sidebarWidth } = useDisplayMode();
  // Portals are browser-only: skip them on the server and during hydration.
  if (!mounted) return null;
  return createPortal(
    <div
      className="qurbi-above-nav pointer-events-none fixed inset-x-0 z-40 px-3 transition-[left] duration-300 ease-out sm:px-4"
      style={{ left: isDesktop ? sidebarWidth : 0 }}
      role="region"
      aria-label={label}
    >
      <div
        className={`qurbi-action-bar pointer-events-auto mx-auto flex w-full max-w-2xl items-center rounded-2xl border p-2.5 sm:p-3 ${className.includes("gap-") ? "" : "gap-3"} ${TONES[tone] || TONES.dark} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
