import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ArrowLeft, Bell, Leaf, LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useNotifications } from "@/lib/notification-context";
import { recentPageOr } from "@/lib/navigation";
import { useDisplayMode } from "@/lib/display-mode-context";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import ProfileAvatar from "@/components/ProfileAvatar";

const HEADER_SHRINK_SCROLL_Y = 12;
const HEADER_EXPAND_SCROLL_Y = 4;
const HEADER_COLLAPSED_HEIGHT = 108;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Shared QURBI page header for normal in-app screens. */
export default function AppHeader({
  title,
  desktopTitle = "",
  eyebrow = "QURBI",
  subtitle = "",
  backTo = "",
  onBack = null,
  leftAction = null,
  search = null,
  children = null,
  sticky = false,
  progressiveShrink = false,
  thresholdShrink = false,
  titleClassName = "",
  subtitleClassName = "",
  preferRecentBack = true,
  backState = undefined,
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuth();
  const { isDesktop } = useDisplayMode();
  const { requestSignIn } = useAuthPrompt();
  const { unreadCount } = useNotifications();
  const showNotificationAction =
    location.pathname !== "/profile" &&
    location.pathname !== "/notifications";
  const isProfilePage = location.pathname === "/profile";
  const {
    isContracting,
    beginIconTransition,
    navigateWithTransition,
    requestIconClose,
  } = useHeaderTransition();
  const hasExpandableContent = Boolean(search || children);
  const [extraVisible, setExtraVisible] = useState(false);
  const [headerEntered, setHeaderEntered] = useState(false);
  const [isScrollShrunk, setIsScrollShrunk] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const headerRef = useRef(null);
  const profileButtonRef = useRef(null);
  const pendingProfileActionRef = useRef(null);
  const [profileMenu, setProfileMenu] = useState(null);
  const useDesktopHeaderBox = isDesktop && !isProfilePage;
  const resolvedDesktopTitle = desktopTitle || title;
  // Desktop follows the Farmer dashboard's fixed hero-card treatment. Header
  // contraction remains a mobile-only interaction.
  const shrinkEnabled = !isDesktop && (progressiveShrink || thresholdShrink);
  const headerExpanded = headerEntered;
  const routeContentVisible =
    useDesktopHeaderBox || (headerEntered && !isContracting && !isScrollShrunk);
  const expandedContentVisible =
    extraVisible && (useDesktopHeaderBox || (!isContracting && !isScrollShrunk));
  const headerCopyAnimation = useDesktopHeaderBox
    ? ""
    : isContracting || isScrollShrunk
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
    const page = headerRef.current.closest(".qurbi-page");
    if (!page) return undefined;

    page.style.setProperty(
      "--qurbi-header-collapse-offset",
      `${Math.max(0, expandedHeight - HEADER_COLLAPSED_HEIGHT - HEADER_SHRINK_SCROLL_Y)}px`,
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
          height:
            isScrollShrunk || isContracting
              ? `${HEADER_COLLAPSED_HEIGHT}px`
              : `${expandedHeight}px`,
          paddingTop: isScrollShrunk || isContracting ? "12px" : "28px",
          paddingBottom: isScrollShrunk || isContracting ? "8px" : "16px",
          transition:
            "height 440ms cubic-bezier(0.22, 1, 0.36, 1), padding 440ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "height, padding",
        }
      : isScrollShrunk || isContracting
        ? {
            height: `${HEADER_COLLAPSED_HEIGHT}px`,
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

  const openProfileMenu = useCallback((button) => {
    if (!button) return;
    beginIconTransition("profile", button);
    const bounds = button.getBoundingClientRect();
    const width = 176;
    const left = Math.min(
      Math.max(12, bounds.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const top = Math.min(bounds.bottom + 8, window.innerHeight - 132);
    pendingProfileActionRef.current = null;
    setProfileMenu({
      phase: "opening",
      left,
      top,
      originX: bounds.left + bounds.width / 2 - left,
      originY: bounds.top + bounds.height / 2 - top,
    });
  }, [beginIconTransition]);

  const closeProfileMenu = useCallback((action = null) => {
    pendingProfileActionRef.current = action;
    setProfileMenu((current) =>
      current ? { ...current, phase: "closing" } : current,
    );
  }, []);

  useEffect(() => {
    if (profileMenu?.phase !== "closing") return undefined;
    const timer = window.setTimeout(() => {
      const action = pendingProfileActionRef.current;
      pendingProfileActionRef.current = null;
      setProfileMenu(null);

      if (action === "profile") {
        if (location.pathname !== "/profile") {
          beginIconTransition("profile", profileButtonRef.current);
          navigateWithTransition("/profile", { transitionType: "profile" });
        }
      } else if (action === "logout") {
        logout();
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [beginIconTransition, location.pathname, logout, navigateWithTransition, profileMenu?.phase]);

  useEffect(() => {
    if (!profileMenu) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeProfileMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeProfileMenu, profileMenu]);

  useEffect(() => {
    if (!isProfilePage || !profileMenu) return;
    pendingProfileActionRef.current = null;
    setProfileMenu(null);
  }, [isProfilePage, profileMenu]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    const destination = preferRecentBack
      ? recentPageOr(backTo)
      : backTo;
    navigateWithTransition(destination, {
      navigateOptions:
        !preferRecentBack && backState !== undefined
          ? { state: backState }
          : undefined,
    });
  };

  const notificationAction = isAuthenticated && showNotificationAction ? (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        beginIconTransition("notification", event.currentTarget);
        navigateWithTransition("/notifications", {
          transitionType: "notification",
        });
      }}
      aria-label={
        unreadCount
          ? t("appHeader.notificationsUnread", { count: unreadCount })
          : t("appHeader.notifications")
      }
      className="group relative flex h-11 w-11 flex-none items-center justify-center rounded-full bg-transparent text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#E3C19F] active:scale-90"
    >
      <Bell className="h-10 w-6 transition-transform duration-200 group-hover:scale-110" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[#DC2626] px-1 text-[11px] font-bold leading-none text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  ) : null;

  const desktopHeaderMarkup = (
    <header
      ref={isDesktop ? headerRef : undefined}
      data-page-description={subtitle || undefined}
      data-description-class={subtitleClassName || undefined}
      className="qurbi-desktop-page-header qurbi-header-background relative z-20 mx-auto mt-5 w-[calc(100%-2.5rem)] max-w-[61.5rem] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-5 text-white shadow-[0_10px_28px_rgba(65,54,45,0.18)] sm:px-8 sm:py-6"
      style={{ viewTransitionName: "qurbi-header" }}
    >
      <div className="relative z-10 flex min-h-11 min-w-0 items-start justify-center px-14 text-center">
        <div className="absolute left-0 top-0 flex items-center gap-2">
          {(backTo || onBack) && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t("appHeader.goBack")}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {!backTo && !onBack && leftAction ? (
            <div className="flex-none">{leftAction}</div>
          ) : null}
        </div>
        <div className="min-w-0 max-w-3xl pt-0.5">
          {resolvedDesktopTitle ? (
            <h1
              className={`truncate text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl ${titleClassName}`}
              title={resolvedDesktopTitle}
            >
              {resolvedDesktopTitle}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className={`mt-1.5 text-sm leading-relaxed text-white/80 ${subtitleClassName}`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {notificationAction ? (
          <div className="absolute right-0 top-0">{notificationAction}</div>
        ) : null}
      </div>

      {hasExpandableContent ? (
        <div className="relative z-10 mt-4">
          {search ? <div className="w-full">{search}</div> : null}
          {children ? <div className={search ? "mt-3" : ""}>{children}</div> : null}
        </div>
      ) : null}
    </header>
  );

  const headerMarkup = (
    <header
      ref={headerRef}
      data-page-description={subtitle || undefined}
      data-description-class={subtitleClassName || undefined}
      className={`${shrinkEnabled ? (expandedHeight ? "absolute inset-x-0 top-0" : "relative") : sticky ? "sticky top-0 z-30" : "relative"} qurbi-header-background overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 shadow-lg transition-[padding,border-radius,box-shadow] duration-500 ease-in-out sm:px-5 ${headerExpanded ? "pb-4 pt-7 sm:pt-8" : "pb-2 pt-3 sm:pt-4"}`}
      style={{ viewTransitionName: "qurbi-header", ...shrinkStyle }}
    >
      <div
        className="relative z-20 flex flex-col items-center text-center"
      >
        <div className="absolute -top-2 left-0 z-30 flex flex-row items-center gap-1">
          {(backTo || onBack) && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t("appHeader.goBack")}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-transform active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {!backTo && !onBack && leftAction}
        </div>

        <div className="pointer-events-auto absolute -top-2 right-0 z-30 flex flex-row items-center gap-1">
          {!isAuthenticated && !isDesktop && (
            <button
              type="button"
              onClick={() => requestSignIn({ returnTo: `${location.pathname}${location.search}${location.hash}` })}
              aria-label={t("appHeader.openProfile")}
              className="relative flex h-11 w-11 flex-none items-center justify-center transition-transform active:scale-90"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-lg">
                <User className="h-5 w-5 text-[#41362D]" />
              </div>
            </button>
          )}
          {notificationAction}
          {isAuthenticated && !isDesktop && (
            <button
              ref={profileButtonRef}
              type="button"
              data-profile-trigger
              data-profile-action-trigger={!isProfilePage ? "" : undefined}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (isProfilePage) {
                  beginIconTransition("profile", event.currentTarget);
                  if (!requestIconClose("profile")) {
                    navigateWithTransition(recentPageOr("/"), {
                      transitionType: "profile",
                    });
                  }
                  return;
                }

                if (profileMenu) closeProfileMenu();
                else openProfileMenu(event.currentTarget);
              }}
              aria-expanded={isProfilePage ? undefined : Boolean(profileMenu)}
              aria-haspopup={isProfilePage ? undefined : "menu"}
              aria-label={
                isProfilePage
                  ? t("appHeader.closeProfile")
                  : t("appHeader.openProfile")
              }
              className="relative flex h-11 w-11 flex-none items-center justify-center transition-transform active:scale-90"
            >
              <ProfileAvatar
                src={user?.avatarUrl || user?.avatar_url}
                name={user?.display_name || user?.full_name || user?.email}
                className="h-10 w-10 rounded-full border-2 text-xs"
              />
            </button>
          )}
        </div>

        {!isDesktop ? (
          <div className="qurbi-header-static-brand pointer-events-none flex items-center justify-center gap-2 self-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F7EDE2]/70 bg-white/10 shadow-sm backdrop-blur-sm">
              <Leaf className="h-3.5 w-3.5 text-white" />
            </div>
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
                {eyebrow}
              </p>
            )}
          </div>
        ) : null}

        {title && (
          <div
            className={`qurbi-header-route-copy grid w-full ${routeContentVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            aria-hidden={!routeContentVisible}
          >
            <div className="min-h-0 overflow-hidden">
              <h1
                className={`mx-auto mt-1 max-w-[calc(100%-9rem)] text-xl font-bold leading-tight tracking-tight text-white sm:max-w-none ${headerCopyAnimation} ${titleClassName}`}
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
        className={`qurbi-header-route-copy relative z-10 grid ${expandedContentVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        aria-hidden={!expandedContentVisible}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={shrinkingContentStyle}
        >
          <div
            className={`pt-2 text-center transition-all duration-500 ease-in-out ${expandedContentVisible ? "translate-y-0" : "-translate-y-2"}`}
          >
            {search && <div className="mx-auto max-w-xl">{search}</div>}
            {children && <div className="mt-2">{children}</div>}
          </div>
        </div>
      </div>
    </header>
  );

  const profileActionMenu = !isProfilePage && profileMenu && typeof document !== "undefined"
    ? createPortal(
        <div className="qurbi-profile-action-layer">
          <button
            type="button"
            className="qurbi-profile-action-backdrop"
            aria-label={t("appHeader.profileMenu.close")}
            onClick={() => closeProfileMenu()}
          />
          <div
            role="menu"
            aria-label={t("appHeader.profileMenu.label")}
            className={`qurbi-profile-action-menu qurbi-profile-action-menu-${profileMenu.phase}`}
            style={
              /** @type {React.CSSProperties} */ ({
                left: `${profileMenu.left}px`,
                top: `${profileMenu.top}px`,
                "--profile-menu-origin-x": `${profileMenu.originX}px`,
                "--profile-menu-origin-y": `${profileMenu.originY}px`,
              })
            }
            onAnimationEnd={() => {
              setProfileMenu((current) =>
                current?.phase === "opening"
                  ? { ...current, phase: "open" }
                  : current,
              );
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="qurbi-profile-action-item"
              onClick={() => closeProfileMenu("profile")}
            >
              <User className="h-4 w-4" />
              <span>{t("appHeader.profileMenu.profile")}</span>
            </button>
            <div className="mx-3 h-px bg-[#41362D]/15" />
            <button
              type="button"
              role="menuitem"
              className="qurbi-profile-action-item text-[#B42318]"
              onClick={() => closeProfileMenu("logout")}
            >
              <LogOut className="h-4 w-4" />
              <span>{t("appHeader.profileMenu.logout")}</span>
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (useDesktopHeaderBox) {
    return (
      <>
        {desktopHeaderMarkup}
        {profileActionMenu}
      </>
    );
  }

  if (!shrinkEnabled) {
    return (
      <>
        {headerMarkup}
        {profileActionMenu}
      </>
    );
  }

  return (
    <>
      <div
        className={`qurbi-shrinkable-header-shell ${sticky ? "sticky top-0 z-30" : "relative"} w-full`}
        style={expandedHeight ? { height: `${expandedHeight}px` } : undefined}
      >
        {headerMarkup}
      </div>
      {profileActionMenu}
    </>
  );
}
