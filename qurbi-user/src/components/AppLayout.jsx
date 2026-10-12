import React from "react";
import BottomNav from "@/components/BottomNav";
import PageTransitionOutlet from "@/components/PageTransitionOutlet";
import Sidebar from "@/components/Sidebar";
import { useDisplayMode } from "@/lib/display-mode-context";

// Mobile / tablet: bottom navigation. Desktop (lg+): left sidebar, with the
// page content shifted over by the sidebar's width.
export default function AppLayout() {
  const { isDesktop } = useDisplayMode();

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] ${isDesktop ? "grid grid-cols-[260px_minmax(0,1fr)]" : ""}`}
    >
      {isDesktop ? <Sidebar /> : null}
      <div
        className={`${isDesktop ? "qurbi-desktop-content" : "qurbi-mobile-content"} min-w-0`}
      >
        <PageTransitionOutlet />
      </div>
      {!isDesktop ? <BottomNav /> : null}
    </div>
  );
}
