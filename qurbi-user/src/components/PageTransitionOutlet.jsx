import React from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useDisplayMode } from "@/lib/display-mode-context";

export default function PageTransitionOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const {
    phase,
    isIconClosing,
    iconOrigin,
    transitionType,
    usesNativeProfileSlide,
    isProfileNavigationBack,
  } =
    useHeaderTransition();
  const { isDesktop } = useDisplayMode();
  const hasIconOverlay = Boolean(location.state?.qurbiIconOverlay);
  const pageType =
    location.pathname === "/notifications"
      ? "notification"
      : location.pathname === "/profile"
        ? "profile"
        : null;
  const usesIconOrigin = Boolean(
    !isDesktop && pageType && iconOrigin?.type === pageType && transitionType === pageType,
  );
  const keepsBackgroundStable = Boolean(
    !pageType &&
      (transitionType === "profile" || transitionType === "notification"),
  );
  const isProfileNavigation = transitionType === "profile-navigation";

  const animationClass = isProfileNavigation
    ? !usesNativeProfileSlide && isProfileNavigationBack && phase === "exiting"
      ? "animate-profile-navigation-back-exit"
      : phase === "entering" && !usesNativeProfileSlide
        ? isProfileNavigationBack
          ? "animate-profile-navigation-back-enter"
          : "animate-profile-navigation-slide-enter"
        : ""
    : hasIconOverlay || keepsBackgroundStable
    ? ""
    : usesIconOrigin
    ? isIconClosing
      ? `animate-${pageType}-origin-exit`
      : `animate-${pageType}-origin-enter`
    : phase === "exiting"
      ? "animate-page-exit"
      : phase === "entering"
        ? "animate-page-enter"
        : "";

  return (
    <div
      className={`qurbi-page-transition-outlet ${animationClass}`}
      style={
        isProfileNavigation &&
        usesNativeProfileSlide &&
        !hasIconOverlay
          ? { viewTransitionName: "qurbi-profile-navigation-page" }
          : usesIconOrigin
          ? {
              "--icon-origin-x": `${iconOrigin.x}px`,
              "--icon-origin-y": `${iconOrigin.y}px`,
            }
          : undefined
      }
    >
      {outlet}
    </div>
  );
}
