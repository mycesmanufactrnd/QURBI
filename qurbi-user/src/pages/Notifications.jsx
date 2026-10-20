import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Info,
  Megaphone,
  Package,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/notification-context";
import { orderDateKey, orderTimestamp } from "@/lib/order-date";
import { dayHeading, timeOnly } from "@/components/account/dates";
import { dangerBtn, secondaryBtn } from "@/components/account/buttons";
import { QurbiCardSkeleton } from "@/components/QurbiLoading";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { recentPageOr } from "@/lib/navigation";
import AuthRequiredState from "@/components/AuthRequiredState";

const TYPE_STYLE = {
  farmer_photo: {
    icon: Camera,
    iconClass: "bg-[#E3C19F] text-[#41362D]",
  },
  refund_approved: {
    icon: CheckCircle2,
    iconClass: "bg-[#E3C19F] text-[#41362D]",
  },
  refund_rejected: {
    icon: XCircle,
    iconClass: "bg-[#FBE4E1] text-[#8A1C12]",
  },
  payment: {
    icon: CreditCard,
    iconClass: "bg-[#FDF0D5] text-[#7A4B00]",
  },
  order_update: {
    icon: Package,
    iconClass: "bg-[#F7EDE2] text-[#41362D]",
  },
  delivery: {
    icon: Truck,
    iconClass: "bg-[#E3C19F] text-[#41362D]",
  },
  promotion: {
    icon: Megaphone,
    iconClass: "bg-[#E3C19F] text-[#41362D]",
  },
  verification: {
    icon: ShieldCheck,
    iconClass: "bg-[#F7EDE2] text-[#41362D]",
  },
  request_update: {
    icon: Package,
    iconClass: "bg-[#F7EDE2] text-[#41362D]",
  },
  listing: {
    icon: Package,
    iconClass: "bg-[#F7EDE2] text-[#41362D]",
  },
  system: {
    icon: Info,
    iconClass: "bg-[#F7EDE2] text-[#41362D]",
  },
  general: {
    icon: Bell,
    iconClass: "bg-[#E3C19F] text-[#41362D]",
  },
};

/**
 * Accept both backend and older frontend notification formats.
 */
function normalizeNotification(raw) {
  const link =
    typeof raw.linkUrl === "string"
      ? raw.linkUrl
      : raw.link_url || "";

  const orderFromLink =
    link.match(/^\/orders\/([^/?#]+)/)?.[1] || "";

  return {
    ...raw,

    event_at:
      raw.event_at ||
      raw.createdAt ||
      raw.created_at ||
      raw.created_date ||
      null,

    message:
      raw.message ??
      raw.body ??
      "",

    is_read: Boolean(
      raw.is_read ??
      raw.isRead
    ),

    order_id:
      raw.order_id ||
      raw.orderId ||
      (orderFromLink
        ? decodeURIComponent(orderFromLink)
        : ""),

    link_url: link,

    image_url:
      raw.image_url ||
      raw.imageUrl ||
      "",
  };
}

function SwipeableNotificationRow({
  notification,
  opening,
  clearing,
  onOpen,
  onClear,
}) {
  const { t } = useTranslation("orders");
  const { t: ta } = useTranslation("account");

  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [rowHeight, setRowHeight] = useState(null);

  const rowRef = useRef(null);
  const surfaceRef = useRef(null);
  const dragOffsetRef = useRef(0);
  const gesture = useRef({ pointerId: null, startX: 0, startY: 0, axis: null });
  const didSwipe = useRef(false);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const updateHeight = () => setRowHeight(surface.scrollHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const style =
    TYPE_STYLE[notification.type] ||
    TYPE_STYLE.farmer_photo;

  const Icon = style.icon;
  const unread = !notification.is_read;
  const showImage = Boolean(notification.image_url) && !imageFailed;

  const dismissNotification = async () => {
    if (dismissing || clearing) return;
    setDismissing(true);
    setExpanded(false);
    const exitOffset = -Math.max(window.innerWidth, (rowRef.current?.offsetWidth || 320) * 1.2);
    dragOffsetRef.current = exitOffset;
    setDragOffset(exitOffset);
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    setCollapsing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const cleared = await onClear(notification.id);
    if (!cleared) {
      setCollapsing(false);
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setDismissing(false);
    }
  };

  const handlePointerDown = (event) => {
    if (opening || clearing || dismissing || event.button > 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
    };
    didSwipe.current = false;
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (gesture.current.pointerId !== event.pointerId) return;
    const distanceX = event.clientX - gesture.current.startX;
    const distanceY = event.clientY - gesture.current.startY;

    if (!gesture.current.axis && (Math.abs(distanceX) > 7 || Math.abs(distanceY) > 7)) {
      gesture.current.axis = Math.abs(distanceX) > Math.abs(distanceY) ? "x" : "y";
      if (gesture.current.axis === "x") {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    }
    if (gesture.current.axis !== "x") return;

    event.preventDefault();
    didSwipe.current = Math.abs(distanceX) > 12;
    const rowWidth = rowRef.current?.offsetWidth || 320;
    const leftDistance = Math.max(-rowWidth * 1.08, Math.min(0, distanceX));
    dragOffsetRef.current = leftDistance;
    setDragOffset(leftDistance);
  };

  const finishPointerGesture = (event) => {
    if (gesture.current.pointerId !== event.pointerId) return;
    const horizontalGesture = gesture.current.axis === "x";
    gesture.current = { pointerId: null, startX: 0, startY: 0, axis: null };
    setDragging(false);

    const rowWidth = rowRef.current?.offsetWidth || 320;
    if (horizontalGesture && dragOffsetRef.current <= -Math.max(96, rowWidth * 0.38)) {
      dismissNotification();
      return;
    }
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  /**
   * Clicking the notification card opens the order.
   */
  const handleOpen = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }

    onOpen(notification);
  };

  /**
   * Arrow ONLY expands/collapses.
   * It never opens the order.
   */
  const handleExpand = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setExpanded((previous) => !previous);
  };

  return (
    <div
      ref={rowRef}
      className="relative isolate overflow-hidden rounded-2xl transition-[max-height,opacity,margin,transform] duration-200 ease-out"
      style={{
        maxHeight: collapsing ? 0 : rowHeight == null ? undefined : `${rowHeight}px`,
        opacity: collapsing ? 0 : 1,
        marginTop: collapsing ? 0 : undefined,
        marginBottom: collapsing ? 0 : undefined,
        transform: collapsing ? "scale(0.97)" : "scale(1)",
      }}
    >
      {/* Swipe delete background */}
      <div
        aria-hidden="true"
        className="notification-delete-surface absolute inset-0 z-0 flex items-center justify-end pr-7 text-white"
        style={{ opacity: Math.min(1, Math.abs(dragOffset) / 90) }}
      >
        <span className="flex flex-col items-center gap-1 text-xs font-bold">
          <Trash2 className="h-6 w-6" />
          {t("notifications.clear")}
        </span>
      </div>

      {/* Main sliding notification surface */}
      <div
        ref={surfaceRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerGesture}
        onPointerCancel={finishPointerGesture}
        className={`relative z-10 touch-pan-y will-change-transform ${dragging ? "transition-none" : "transition-transform duration-300 ease-out"}`}
        style={{
          transform: `translateX(${dragOffset}px)`,
        }}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border-2 shadow-sm ${
            unread
              ? "qurbi-dark-surface border-[#E3C19F]"
              : "border-[#E3C19F] bg-[#FFFDF9]"
          }`}
        >
          {/* Main notification button */}
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening || clearing}
            aria-label={`${unread ? ta("notifications.unreadPrefix") : ""}${notification.title}`}
            className="flex min-h-[76px] w-full touch-pan-y items-center gap-3 py-3.5 pl-4 pr-[104px] text-left"
          >
            {/* Contextual notification thumbnail, with a type-specific fallback. */}
            <span
              className={`relative flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl ${style.iconClass}`}
            >
              {showImage ? (
                <img
                  src={notification.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Icon
                  className="h-6 w-6"
                  aria-hidden="true"
                />
              )}

              {unread && (
                <span
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#D92D20] ring-2 ring-[#41362D]"
                  aria-hidden="true"
                />
              )}
            </span>

            {/* Collapsed content: TITLE ONLY */}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={`break-words text-[15px] leading-snug ${
                    unread
                      ? "font-bold text-white"
                      : "font-semibold text-[#41362D]"
                  }`}
                >
                  {notification.title}
                </span>

                {unread && (
                  <span className="rounded-full bg-[#E3C19F] px-2 py-0.5 text-[11px] font-bold text-[#41362D]">
                    {ta("notifications.new")}
                  </span>
                )}
              </span>
            </span>
          </button>

          {/* Expand arrow */}
          <button
            type="button"
            onClick={handleExpand}
            disabled={opening || clearing}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? "Collapse notification"
                : "Expand notification"
            }
            className={`absolute right-[48px] top-4 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 active:scale-90 disabled:opacity-50 ${
              unread
                ? "text-white hover:bg-white/10"
                : "text-[#41362D] hover:bg-[#F7EDE2]"
            }`}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`}
              aria-hidden="true"
            />
          </button>

          {/* Clear notification */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              dismissNotification();
            }}
            disabled={clearing || opening}
            aria-label={t(
              "notifications.clearAria",
              {
                title: notification.title,
              }
            )}
            className={`absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50 ${
              unread
                ? "text-white/80 hover:bg-white/10"
                : "text-[#6B594A] hover:bg-[#F7EDE2]"
            }`}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>

          {/* Expanded details ONLY */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              expanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={`mx-4 mb-4 ml-[84px] border-t pt-3 ${
                  unread
                    ? "border-[#E3C19F]/40"
                    : "border-[#E3C19F]"
                }`}
              >
                {/* Full notification message */}
                {notification.message && (
                  <p
                    className={`text-sm leading-relaxed ${
                      unread
                        ? "text-white/90"
                        : "text-[#41362D]"
                    }`}
                  >
                    {notification.message}
                  </p>
                )}

                {/* Notification type */}
                {notification.type && (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      unread
                        ? "text-white/60"
                        : "text-[#6B594A]"
                    }`}
                  >
                    {notification.type}
                  </p>
                )}

                {/* Timestamp */}
                <p
                  className={`mt-1 text-xs font-medium ${
                    unread
                      ? "text-white/60"
                      : "text-[#6B594A]"
                  }`}
                >
                  {timeOnly(
                    notification.event_at,
                    ta
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { t } = useTranslation("orders");
  const { t: ta } = useTranslation("account");

  const {
    navigateFromIconPage,
    requestIconClose,
  } = useHeaderTransition();

  const {
    authChecked,
    isAuthenticated,
  } = useAuth();

  const {
    notifications: rawNotifications,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    clearNotification,
    clearAllNotifications,
  } = useNotifications();

  const [openingId, setOpeningId] =
    useState("");

  const [clearingId, setClearingId] =
    useState("");

  const [showClearAll, setShowClearAll] =
    useState(false);

  const [clearingAll, setClearingAll] =
    useState(false);

  const notifications = useMemo(
    () =>
      rawNotifications.map(
        normalizeNotification
      ),
    [rawNotifications]
  );

  const unreadCount =
    notifications.filter(
      (item) => !item.is_read
    ).length;

  const groups = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) =>
        orderTimestamp(b.event_at) -
        orderTimestamp(a.event_at)
    );

    const grouped = new Map();

    for (const notification of sorted) {
      const key = orderDateKey(
        notification.event_at
      );

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: dayHeading(
            notification.event_at,
            ta
          ),
          notifications: [],
        });
      }

      grouped
        .get(key)
        .notifications.push(notification);
    }

    return [...grouped.values()];
  }, [notifications, ta]);

  const openNotification = async (
    notification
  ) => {
    if (openingId) return;

    setOpeningId(notification.id);

    try {
      // Opening a notification must not be blocked by a slow or failed
      // mark-as-read request. The context applies the read state optimistically
      // and handles any API failure separately.
      if (!notification.is_read) {
        void markAsRead(notification.id);
      }

      if (notification.order_id) {
        navigateFromIconPage(
          `/orders/${encodeURIComponent(
            notification.order_id
          )}`,
          {
            state: {
              fromNotification: true,
              refreshOrderAt: Date.now(),
            },
          }
        );
      } else if (
        notification.link_url?.startsWith("/") &&
        !notification.link_url.startsWith("//")
      ) {
        navigateFromIconPage(
          notification.link_url
        );
      }
    } finally {
      setOpeningId("");
    }
  };

  const clearOne = async (
    notificationId
  ) => {
    if (clearingId || clearingAll) return false;

    setClearingId(notificationId);

    const cleared = await clearNotification(
      notificationId
    );

    setClearingId("");
    return cleared;
  };

  const clearAll = async () => {
    if (clearingAll) return;

    setClearingAll(true);

    const cleared =
      await clearAllNotifications();

    setClearingAll(false);

    if (cleared) {
      setShowClearAll(false);
    }
  };

  if (
    authChecked &&
    !isAuthenticated
  ) {
    return (
      <AuthRequiredState
        title={t(
          "notifications.title"
        )}
        message={t(
          "notifications.signInPrompt"
        )}
        returnTo="/notifications"
      />
    );
  }

  return (
    <main className="qurbi-page min-h-screen px-4 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
      <section className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!requestIconClose("notification")) {
                navigateFromIconPage(
                  recentPageOr("/")
                );
              }
            }}
            aria-label={t(
              "notifications.goBackAria"
            )}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white transition-transform active:scale-90"
          >
            <ArrowLeft
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#41362D]/70">
              QURBI
            </p>

            <h1 className="text-2xl font-bold leading-tight text-[#41362D]">
              {t(
                "notifications.title"
              )}
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              refreshNotifications()
            }
            disabled={loading}
            aria-label={t(
              "notifications.refreshAria"
            )}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border-2 border-[#6B594A] text-[#41362D] transition-transform active:scale-90 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-5 w-5 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />
          </button>
        </div>

        <div className="qurbi-icon-page-content">

          {/* Unread / Clear all */}
          {notifications.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p
                className="text-[15px] font-semibold text-[#41362D]"
                aria-live="polite"
              >
                {unreadCount > 0
                  ? ta(
                      "notifications.unreadCount",
                      {
                        count:
                          unreadCount,
                      }
                    )
                  : ta(
                      "notifications.allRead"
                    )}
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowClearAll(true)
                }
                className="min-h-11 flex-none rounded-xl px-3 text-sm font-bold text-[#41362D] underline underline-offset-4"
              >
                {t(
                  "notifications.clearAll"
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8A39A] bg-[#FBE4E1] px-4 py-3 text-sm font-semibold text-[#8A1C12]"
            >
              <span>{error}</span>

              <button
                type="button"
                onClick={() =>
                  refreshNotifications()
                }
                className="min-h-11 rounded-lg px-2 font-bold underline"
              >
                {ta(
                  "notifications.retry"
                )}
              </button>
            </div>
          )}

          {/* Loading */}
          {loading &&
          !notifications.length ? (
            <div className="mt-6">
              <QurbiCardSkeleton
                count={4}
                variant="list"
              />
            </div>
          ) : !groups.length ? (
            /* Empty state */
            <div className="mt-8 rounded-3xl border border-[#E3C19F] bg-[#FFFDF9]/80 px-6 py-12 text-center shadow-sm">
              <Bell
                className="mx-auto h-10 w-10 text-[#6B594A]"
                aria-hidden="true"
              />

              <h2 className="mt-4 text-base font-bold text-[#41362D]">
                {t(
                  "notifications.emptyTitle"
                )}
              </h2>

              <p className="mx-auto mt-1 max-w-xs text-[15px] text-[#41362D]/75">
                {t(
                  "notifications.emptyBody"
                )}
              </p>

              <button
                type="button"
                onClick={() =>
                  navigateFromIconPage(
                    "/orders"
                  )
                }
                className={`${secondaryBtn} mt-5 px-6`}
              >
                {ta(
                  "notifications.goToOrders"
                )}
              </button>
            </div>
          ) : (
            /* Notification groups */
            <div className="mt-5 space-y-6 animate-content-ready">
              {groups.map((group) => (
                <section
                  key={group.key}
                  aria-label={
                    group.label
                  }
                >
                  <h2 className="mb-2.5 px-1 text-sm font-bold text-[#41362D]/80">
                    {group.label}
                  </h2>

                  <div className="space-y-3">
                    {group.notifications.map(
                      (notification) => (
                        <SwipeableNotificationRow
                          key={
                            notification.id
                          }
                          notification={
                            notification
                          }
                          opening={
                            openingId ===
                            notification.id
                          }
                          clearing={
                            clearingId ===
                            notification.id
                          }
                          onOpen={
                            openNotification
                          }
                          onClear={
                            clearOne
                          }
                        />
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Clear all modal */}
      {showClearAll && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-notifications-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#E3C19F] bg-[#FFFDF9] p-5 text-center shadow-2xl">
            <h2
              id="clear-notifications-title"
              className="text-lg font-bold text-[#41362D]"
            >
              {t(
                "notifications.clearAllModal.title"
              )}
            </h2>

            <p className="mt-2 text-[15px] text-[#5A493C]">
              {t(
                "notifications.clearAllModal.body"
              )}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowClearAll(false)
                }
                disabled={clearingAll}
                className={secondaryBtn}
              >
                {t(
                  "notifications.clearAllModal.keep"
                )}
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={clearingAll}
                className={dangerBtn}
              >
                {clearingAll
                  ? t(
                      "notifications.clearing"
                    )
                  : t(
                      "notifications.clearAll"
                    )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
