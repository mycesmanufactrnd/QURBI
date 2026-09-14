import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";

export default function AppLayout() {
  const location = useLocation();
  const { isContracting, isIconClosing, iconOrigin } = useHeaderTransition();
  const specialType =
    location.pathname === "/notifications"
      ? "notification"
      : location.pathname === "/profile"
        ? "profile"
        : null;
  const usesIconOrigin = specialType && iconOrigin?.type === specialType;
  const animationClass = usesIconOrigin
    ? isIconClosing
      ? `animate-${specialType}-origin-exit`
      : `animate-${specialType}-origin-enter`
    : isContracting
      ? "animate-page-exit"
      : "animate-page-enter";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
      <div
        key={location.key}
        className={animationClass}
        style={
          usesIconOrigin
            ? {
                "--icon-origin-x": `${iconOrigin.x}px`,
                "--icon-origin-y": `${iconOrigin.y}px`,
              }
            : undefined
        }
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
