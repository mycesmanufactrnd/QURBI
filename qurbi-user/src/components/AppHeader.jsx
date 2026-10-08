import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Bell, Leaf, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useNotifications } from "@/lib/notification-context";
import { recentPageOr } from "@/lib/navigation";

const HEADER_SHRINK_SCROLL_Y = 12;
const HEADER_EXPAND_SCROLL_Y = 4;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Shared QURBI page header for normal in-app screens. */
export default function AppHeader({
  title,
  eyebrow = "QURBI",
  subtitle = "",
  backTo = "",
  leftAction = null,
  search = null,
  children = null,
  sticky = false,
  guestActionsOnLeft = false,
  progressiveShrink = false,
  thresholdShrink = false,
  titleClassName = "",
  subtitleClassName = "",
  preferRecentBack = true,
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { isContracting, beginIconTransition, navigateWithTransition } = useHeaderTransition();
  const hasExpandableContent = Boolean(search || children);
  const [extraVisible, setExtraVisible] = useState(false);
  const [headerEntered, setHeaderEntered] = useState(false);
  const [isScrollShrunk, setIsScrollShrunk] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const headerRef = useRef(null);
  const shrinkEnabled = progressiveShrink || thresholdShrink;
  const headerExpanded = headerEntered;
  const routeContentVisible = headerEntered && !isContracting;
  const headerCopyAnimation = isContracting
    ? "animate-header-copy-exit"
    : headerEntered
      ? "animate-header-copy-enter"
      : "header-copy-pending";

  useIsomorphicLayoutEffect(() => {
    // Commit the entered state before the browser's first paint. Waiting for a
    // normal effect/RAF briefly painted the newly mounted route with a compact,
    // empty header and caused a visible flash between pages.
    setHeaderEntered(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!hasExpandableContent) {
      setExtraVisible(false);
      return undefined;
    }
    setExtraVisible(true);
    return undefined;
  }, [hasExpandableContent]);

  useEffect(() => {
    if (!shrinkEnabled) return undefined;
    let frame = 0;
    let shrunk = false;

    // A newly mounted page always starts with its header expanded, even if the
    // browser has not restored/reset the previous route's scroll position yet.
    setIsScrollShrunk(false);

    const updateShrinkState = () => {
      frame = 0;
      const shouldShrink = shrunk
        ? window.scrollY > HEADER_EXPAND_SCROLL_Y
        : window.scrollY >= HEADER_SHRINK_SCROLL_Y;
      if (shouldShrink === shrunk) return;
      shrunk = shouldShrink;
      setIsScrollShrunk(shouldShrink);
    };
    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateShrinkState);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shrinkEnabled, location.pathname]);

  useEffect(() => {
    if (!shrinkEnabled || !headerEntered || !extraVisible) return undefined;
    const timer = window.setTimeout(() => {
      if (headerRef.current) setExpandedHeight(headerRef.current.scrollHeight);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [shrinkEnabled, headerEntered, extraVisible, title]);

  useIsomorphicLayoutEffect(() => {
    if (!shrinkEnabled || !expandedHeight || !headerRef.current) return undefined;
    const page = headerRef.current.closest(".aisyah-page");
    if (!page) return undefined;

    page.style.setProperty(
      "--qurbi-header-collapse-offset",
      `${Math.max(0, expandedHeight - 108 - HEADER_SHRINK_SCROLL_Y)}px`,
    );
    page.classList.toggle("qurbi-header-is-shrunk", isScrollShrunk);

    return () => {
      page.classList.remove("qurbi-header-is-shrunk");
      page.style.removeProperty("--qurbi-header-collapse-offset");
    };
  }, [expandedHeight, isScrollShrunk, shrinkEnabled]);

  const shrinkStyle = shrinkEnabled
    ? expandedHeight
      ? {
          height: isScrollShrunk || isContracting ? "108px" : `${expandedHeight}px`,
          paddingTop: isScrollShrunk || isContracting ? "12px" : "28px",
          paddingBottom: isScrollShrunk || isContracting ? "8px" : "16px",
          transition:
            "height 440ms cubic-bezier(0.22, 1, 0.36, 1), padding 440ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "height, padding",
        }
      : isScrollShrunk || isContracting
        ? {
            height: "108px",
            paddingTop: "12px",
            paddingBottom: "8px",
          }
        : undefined
    : undefined;
  /** @type {React.CSSProperties | undefined} */
  const shrinkingContentStyle = shrinkEnabled
    ? {
        opacity: isScrollShrunk || isContracting ? 0 : 1,
        pointerEvents: isScrollShrunk || isContracting ? "none" : "auto",
        transition: "opacity 320ms ease-out",
        willChange: "opacity",
      }
    : undefined;

  const headerMarkup = (
    <header
      ref={headerRef}
      data-page-description={subtitle || undefined}
      data-description-class={subtitleClassName || undefined}
      className={`${shrinkEnabled ? (expandedHeight ? "absolute inset-x-0 top-0" : "relative") : sticky ? "sticky top-0 z-30" : "relative"} qurbi-header-background overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 shadow-lg transition-[padding,border-radius,box-shadow] duration-500 ease-in-out sm:px-5 ${headerExpanded ? "pb-4 pt-7 sm:pt-8" : "pb-2 pt-3 sm:pt-4"}`}
      style={{ viewTransitionName: "qurbi-header", ...shrinkStyle }}
    >
      <div
        className="relative z-10 flex flex-col items-center text-center"
      >
        <div className="absolute left-0 top-0 z-20 flex flex-row items-center gap-1">
          {!isAuthenticated && guestActionsOnLeft && (
            <>
              <Link
                to="/auth?mode=login"
                className="flex min-h-10 items-center rounded-md px-1.5 text-xs font-bold text-white"
              >
                {t("appHeader.login")}
              </Link>
              <Link
                to="/auth?mode=register"
                className="flex min-h-10 items-center rounded-md border border-white/30 bg-white/15 px-2 text-xs font-bold text-white"
              >
                {t("appHeader.signUp")}
              </Link>
            </>
          )}
          {backTo && (
            <button
              type="button"
              onClick={() =>
                navigateWithTransition(preferRecentBack ? recentPageOr(backTo) : backTo)
              }
              aria-label={t("appHeader.goBack")}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-transform active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {!backTo && leftAction}
        </div>

        <div className="absolute right-0 top-0 z-20 flex flex-row items-center gap-1">
          {!isAuthenticated && !guestActionsOnLeft && (
            <>
              <Link
                to="/auth?mode=login"
                className="flex min-h-10 items-center rounded-md px-1.5 text-xs font-bold text-white"
              >
                {t("appHeader.login")}
              </Link>
              <Link
                to="/auth?mode=register"
                className="flex min-h-10 items-center rounded-md border border-white/30 bg-white/15 px-2 text-xs font-bold text-white"
              >
                {t("appHeader.signUp")}
              </Link>
            </>
          )}
          {isAuthenticated && (
            <Link
              to="/notifications"
              onClick={(event) => {
                if (!event.defaultPrevented) {
                  beginIconTransition("notification", event.currentTarget);
                }
              }}
              aria-label={
                unreadCount
                  ? t("appHeader.notificationsUnread", { count: unreadCount })
                  : t("appHeader.notifications")
              }
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-white transition-transform active:scale-90"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[#DC2626] px-1 text-[11px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {isAuthenticated && (
            <Link
              to="/profile"
              onClick={(event) => {
                if (!event.defaultPrevented) {
                  beginIconTransition("profile", event.currentTarget);
                }
              }}
              aria-label={t("appHeader.openProfile")}
              className="relative flex h-11 w-11 flex-none items-center justify-center transition-transform active:scale-90"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-lg">
                <User className="h-5 w-5 text-[#41362D]" />
              </div>
            </Link>
          )}
        </div>

        <div className="qurbi-header-static-brand pointer-events-none flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F7EDE2]/70 bg-white/10 shadow-sm backdrop-blur-sm">
            <Leaf className="h-3.5 w-3.5 text-white" />
          </div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
              {eyebrow}
            </p>
          )}
        </div>

        {title && (
          <div
            className={`qurbi-header-route-copy grid w-full ${routeContentVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            aria-hidden={!routeContentVisible}
          >
            <div className="min-h-0 overflow-hidden">
              <h1
                className={`mx-auto mt-1 max-w-[65%] text-xl font-bold leading-tight tracking-tight text-white sm:max-w-none ${headerCopyAnimation} ${titleClassName}`}
              >
                {title}
              </h1>
            </div>
          </div>
        )}
      </div>

      {subtitle && (
        <div
          className={`qurbi-header-route-copy relative z-10 grid ${routeContentVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          aria-hidden={!routeContentVisible}
        >
          <div
            className="min-h-0 overflow-hidden"
            style={shrinkingContentStyle}
          >
            <p
              className={`header-copy-description mx-auto mt-2.5 max-w-xl text-center text-sm leading-relaxed text-white/80 ${headerCopyAnimation} ${subtitleClassName}`}
            >
              {subtitle}
            </p>
          </div>
        </div>
      )}

      <div
        className={`qurbi-header-route-copy relative z-10 grid ${extraVisible && !isContracting ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        aria-hidden={!hasExpandableContent}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={shrinkingContentStyle}
        >
          <div
            className={`pt-2 text-center transition-all duration-500 ease-in-out ${extraVisible && !isContracting ? "translate-y-0" : "-translate-y-2"}`}
          >
            {search && <div className="mx-auto max-w-xl">{search}</div>}
            {children && <div className="mt-2">{children}</div>}
          </div>
        </div>
      </div>
    </header>
  );

  if (!shrinkEnabled) return headerMarkup;

  return (
    <div
      className={`qurbi-shrinkable-header-shell ${sticky ? "sticky top-0 z-30" : "relative"} w-full`}
      style={expandedHeight ? { height: `${expandedHeight}px` } : undefined}
    >
      {headerMarkup}
    </div>
  );
}
