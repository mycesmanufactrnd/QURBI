import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Leaf, User } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useNotifications } from "@/lib/notification-context";

/** Shared QURBI page header for normal in-app screens. */
export default function AppHeader({
  title,
  eyebrow = "QURBI",
  subtitle,
  backTo,
  search,
  children,
  sticky = false,
  guestActionsOnLeft = false,
  titleClassName = "",
  subtitleClassName = "",
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { isContracting, beginIconTransition } = useHeaderTransition();
  const hasExpandableContent = Boolean(search || children);
  const [extraVisible, setExtraVisible] = useState(false);
  const [headerEntered, setHeaderEntered] = useState(false);
  const headerExpanded = headerEntered && !isContracting;
  const headerCopyAnimation = isContracting
    ? "animate-header-copy-exit"
    : headerEntered
      ? "animate-header-copy-enter"
      : "header-copy-pending";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeaderEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasExpandableContent) {
      setExtraVisible(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setExtraVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [hasExpandableContent]);

  return (
    <header
      className={`${sticky ? "sticky top-0 z-30" : "relative"} qurbi-header-background overflow-hidden rounded-b-[28px] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 shadow-lg transition-[padding,border-radius,box-shadow] duration-700 ease-in-out sm:px-5 ${headerExpanded ? "pb-4 pt-7 sm:pt-8" : "pb-2 pt-3 sm:pt-4"}`}
      style={{ viewTransitionName: "qurbi-header" }}
    >
      <div
        className={`relative z-10 flex origin-top flex-col items-center text-center transition-transform duration-700 ease-in-out ${headerExpanded ? "scale-100" : "scale-[0.96]"}`}
      >
        <div className="absolute left-0 top-0 z-20 flex flex-row items-center gap-1.5">
          {isAuthenticated && (
            <Link
              to="/notifications"
              onClick={(event) =>
                beginIconTransition("notification", event.currentTarget)
              }
              aria-label={
                unreadCount
                  ? `Open notifications, ${unreadCount} unread`
                  : "Open notifications"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-transform active:scale-90"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {!isAuthenticated && guestActionsOnLeft && (
            <>
              <Link
                to="/login"
                viewTransition
                className="rounded-lg px-1.5 py-2 text-[10px] font-bold text-white/90"
              >
                Login
              </Link>
              <Link
                to="/register"
                viewTransition
                className="rounded-lg bg-white/15 px-1.5 py-2 text-[10px] font-bold text-white"
              >
                Sign Up
              </Link>
            </>
          )}
          {backTo && (
            <button
              type="button"
              onClick={() => navigate(backTo, { viewTransition: true })}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-transform active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="absolute right-0 top-0 z-20 flex flex-row items-center gap-1.5">
          {!isAuthenticated && !guestActionsOnLeft && (
            <>
              <Link
                to="/login"
                viewTransition
                className="rounded-lg px-1.5 py-2 text-[10px] font-bold text-white/90"
              >
                Login
              </Link>
              <Link
                to="/register"
                viewTransition
                className="rounded-lg bg-white/15 px-1.5 py-2 text-[10px] font-bold text-white"
              >
                Sign Up
              </Link>
            </>
          )}
          {isAuthenticated && (
            <Link
              to="/profile"
              onClick={(event) =>
                beginIconTransition("profile", event.currentTarget)
              }
              aria-label="Open profile"
              className="relative flex-none transition-transform active:scale-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-lg">
                <User className="h-4.5 w-4.5 text-[#41362D]" />
              </div>
            </Link>
          )}
        </div>

        <div
          className={`pointer-events-none flex w-full flex-col items-center text-center ${headerCopyAnimation}`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
            {eyebrow}
          </p>
          <h1
            className={`mt-0.5 max-w-[65%] text-xl font-bold leading-tight tracking-tight text-white sm:max-w-none ${titleClassName}`}
          >
            {title}
          </h1>
        </div>
      </div>

      {subtitle && (
        <div
          className={`relative z-10 grid transition-[grid-template-rows] duration-700 ease-in-out ${headerEntered && !isContracting ? "grid-rows-[1fr] delay-0" : "grid-rows-[0fr] delay-100"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <p
              className={`header-copy-description mx-auto mt-2.5 max-w-xl text-center text-sm leading-relaxed text-white/70 ${headerCopyAnimation} ${subtitleClassName}`}
            >
              {subtitle}
            </p>
          </div>
        </div>
      )}

      <div
        className={`relative z-10 grid transition-[grid-template-rows,opacity] duration-700 ease-in-out ${extraVisible && !isContracting ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        aria-hidden={!hasExpandableContent}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`pt-2 text-center transition-all duration-700 ease-in-out ${extraVisible && !isContracting ? "translate-y-0" : "-translate-y-2"}`}
          >
            {search && <div className="mx-auto max-w-xl">{search}</div>}
            {children && <div className="mt-2">{children}</div>}
          </div>
        </div>
      </div>
    </header>
  );
}
