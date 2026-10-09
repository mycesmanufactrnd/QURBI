import React from "react";
import BottomNav from "@/components/BottomNav";
import PageTransitionOutlet from "@/components/PageTransitionOutlet";
import Sidebar from "@/components/Sidebar";
import { useDisplayMode } from "@/lib/display-mode-context";

// Mobile / tablet: bottom navigation. Desktop (lg+): left sidebar, with the
// page content shifted over by the sidebar's width.
export default function AppLayout() {
  const { displayMode, isDesktop, sidebarWidth } = useDisplayMode();

  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] ${displayMode === "mobile" ? "qurbi-forced-mobile-shell" : ""}`}>
      {isDesktop ? <Sidebar /> : null}
      <div
        className={isDesktop ? "qurbi-desktop-content transition-[padding-left] duration-300 ease-out" : ""}
        style={isDesktop ? { paddingLeft: sidebarWidth, "--qurbi-sidebar-width": `${sidebarWidth}px` } : undefined}
      >
        <PageTransitionOutlet />
      </div>
      {!isDesktop ? <BottomNav /> : null}
    </div>
  );
}
