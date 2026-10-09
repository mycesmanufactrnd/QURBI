import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";

export default function IconRouteOverlay({ type, children }) {
  const {
    completeIconClose,
    iconOrigin,
    isIconClosing,
    transitionType,
    usesNativeProfileSlide,
  } = useHeaderTransition();
  const isProfileNavigation = transitionType === "profile-navigation";
  const enteredFromProfileNavigationRef = useRef(isProfileNavigation);
  const [motionState, setMotionState] = useState(() =>
    isProfileNavigation ? "open" : "preparing",
  );
  const origin =
    iconOrigin?.type === type
      ? iconOrigin
      : {
          x: window.innerWidth - 68,
          y: 52,
          left: window.innerWidth - 90,
          top: 30,
          width: 44,
          height: 44,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
  const viewportWidth = Math.max(1, origin.viewportWidth || window.innerWidth);
  const viewportHeight = Math.max(1, origin.viewportHeight || window.innerHeight);
  const scaleX = Math.max(0.001, (origin.width || 44) / viewportWidth);
  const scaleY = Math.max(0.001, (origin.height || 44) / viewportHeight);

  useLayoutEffect(() => {
    if (isProfileNavigation || enteredFromProfileNavigationRef.current) {
      setMotionState("open");
      return undefined;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setMotionState("opening");
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [isProfileNavigation]);

  useEffect(() => {
    if (isIconClosing) setMotionState("closing");
  }, [isIconClosing]);

  const handleAnimationEnd = (event) => {
    if (event.target !== event.currentTarget) return;
    if (motionState === "closing") {
      completeIconClose();
      return;
    }
    if (motionState === "opening") setMotionState("open");
  };

  return (
    <div
      className={`qurbi-icon-route-overlay qurbi-icon-route-overlay-${motionState} ${isProfileNavigation && !usesNativeProfileSlide ? "animate-profile-navigation-slide-enter" : ""}`}
      style={
        /** @type {React.CSSProperties} */ ({
          "--icon-origin-x": `${origin.x}px`,
          "--icon-origin-y": `${origin.y}px`,
          "--icon-origin-left": `${origin.left ?? origin.x - (origin.width || 44) / 2}px`,
          "--icon-origin-top": `${origin.top ?? origin.y - (origin.height || 44) / 2}px`,
          "--icon-origin-scale-x": scaleX,
          "--icon-origin-scale-y": scaleY,
          viewTransitionName:
            type === "profile" &&
            transitionType === "profile-navigation" &&
            usesNativeProfileSlide
              ? "qurbi-profile-navigation-page"
              : undefined,
        })
      }
      data-icon-overlay={type}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
