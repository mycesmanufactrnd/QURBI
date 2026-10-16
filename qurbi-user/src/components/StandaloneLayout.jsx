import React from "react";
import { useLocation } from "react-router-dom";
import PageTransitionOutlet from "@/components/PageTransitionOutlet";
import Sidebar from "@/components/Sidebar";
import { useDisplayMode } from "@/lib/display-mode-context";

export default function StandaloneLayout() {
  const location = useLocation();
  const { isDesktop } = useDisplayMode();
  const showTransactionSidebar = Boolean(
    isDesktop &&
      location.pathname === "/receipt" &&
      location.state?.fromTransactionHistory,
  );

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] ${
        showTransactionSidebar ? "grid grid-cols-[260px_minmax(0,1fr)]" : ""
      }`}
    >
      {showTransactionSidebar ? <Sidebar /> : null}
      <div className={showTransactionSidebar ? "qurbi-desktop-content min-w-0" : ""}>
        <PageTransitionOutlet />
      </div>
    </div>
  );
}
