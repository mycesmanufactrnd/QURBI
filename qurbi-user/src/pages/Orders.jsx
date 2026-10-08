import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Package,
  ReceiptText,
  Clock3,
  ShoppingBag,
} from "lucide-react";
import { qurbiApi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import { useReveal } from "@/hooks/useReveal";
import CancelOrderModal from "@/components/CancelOrderModal";
import AppHeader from "@/components/AppHeader";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { orderDateKey, orderTimestamp } from "@/lib/order-date";
import { formatRM } from "@/lib/format";
import { groupedOrderQuery, groupOrdersByCheckout, groupItemsByFarm } from "@/lib/order-groups";
import PageLoading from "@/components/PageLoading";
import StatusChip from "@/components/account/StatusChip";
import { ORDER_TABS, orderStatusInfo } from "@/components/account/orderStatus";
import { accountMediaUrl } from "@/components/account/media";
import { dayHeading, shortDateTime } from "@/components/account/dates";
import {
  ghostOnDarkBtn,
  lightBtn,
  primaryBtn,
} from "@/components/account/buttons";

function reservationLabel(order, t) {
  if (!order.reservation_expires_at || order.reservation_status !== "active")
    return "";
  const expiresAt = new Date(order.reservation_expires_at);
  if (Number.isNaN(expiresAt.getTime())) return t("orders.reservation.reservedFor24h");
  const formatted = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(expiresAt);
  return `${order.payment_status === "failed" ? t("orders.reservation.paymentFailedPrefix") : ""}${t("orders.reservation.reservedUntil", { time: formatted })}`;
}

function groupOrdersByDay(orders, ta) {
  const sorted = [...orders].sort(
    (a, b) => orderTimestamp(b.created_date) - orderTimestamp(a.created_date),
  );
  return sorted.reduce((groups, order) => {
    const key = orderDateKey(order.created_date);
    const group = groups.find((item) => item.key === key);
    if (group) group.orders.push(order);
    else
      groups.push({
        key,
        label: dayHeading(order.created_date, ta),
        orders: [order],
      });
    return groups;
  }, []);
}

function TransactionHeaderButton({ onOpen }) {
  const { t } = useTranslation("orders");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("orders.openTransactionHistory")}
      className="flex min-h-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 px-3 text-xs font-bold text-white transition-transform active:scale-90"
    >
      {t("orders.transaction")}
    </button>
  );
}

function OrderThumb({ item, size = "h-16 w-16" }) {
  const [failed, setFailed] = useState(false);
  const src = accountMediaUrl(item?.image);
  return (
    <div
      className={`flex ${size} flex-none items-center justify-center overflow-hidden rounded-xl bg-[#F7EDE2] text-[#6B594A]`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
      )}
    </div>
  );
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}) {
  const navigate = useNavigate();
  const { navigateFromProductCard } = useHeaderTransition();
  const { t } = useTranslation("orders");
  const { t: ta } = useTranslation("account");
  const accordionId = useId().replace(/:/g, "");
  const [expandedFarms, setExpandedFarms] = useState(() => new Set());
  const status = orderStatusInfo(order);
  const totalItems =
    order.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0;
  const isPending = status.next === "pay";
  const reservedUntil = isPending ? reservationLabel(order, t) : "";
  const originTab = sessionStorage.getItem("gh_orders_active_tab") || "";
  const groupIds = order.order_ids || [order.id];
  const groupSuffix =
    groupIds.length > 1
      ? `${originTab ? "&" : "?"}group_ids=${encodeURIComponent(groupIds.join(","))}`
      : "";
  const detailsPath = `/orders/${encodeURIComponent(order.id)}${originTab ? `?fromTab=${encodeURIComponent(originTab)}` : ""}${groupSuffix}`;
  const paymentPath = `/payment?${groupedOrderQuery(order)}`;
  const receiptPath = `/receipt?order_id=${encodeURIComponent(order.id)}`;
  const cardDestination = detailsPath;
  const farms = groupItemsByFarm(order.items || []);

  const toggleFarm = (farmKey) => {
    setExpandedFarms((current) => {
      const next = new Set(current);
      if (next.has(farmKey)) next.delete(farmKey);
      else next.add(farmKey);
      return next;
    });
  };

  const primary =
    status.next === "pay"
      ? { to: paymentPath, label: t("orders.completePayment") }
      : status.next === "track"
        ? { to: detailsPath, label: ta("orders.actions.track") }
        : status.next === "confirm"
          ? { to: detailsPath, label: ta("orders.actions.confirm") }
          : status.next === "receipt"
            ? { to: receiptPath, label: ta("orders.actions.receipt") }
            : status.next === "refund"
              ? { to: detailsPath, label: ta("orders.actions.refund") }
              : { to: detailsPath, label: t("orders.viewOrderLink") };

  const handleCardClick = (event) => {
    if (event.target.closest("a, button")) return;
    navigate(cardDestination);
  };

  return (
    <article
      onClick={handleCardClick}
      aria-label={t("orders.aria.viewOrder")}
      className="qurbi-dark-surface relative cursor-pointer overflow-hidden rounded-2xl border"
    >
      <Link
        to={detailsPath}
        onClick={(event) => event.stopPropagation()}
        className="absolute right-3 top-3 z-10 flex min-h-8 items-center rounded-lg border border-[#E3C19F]/70 bg-[#41362D]/80 px-2 text-[11px] font-bold text-white backdrop-blur-sm"
      >
        {t("orderDetail.items.viewDetails")}
      </Link>
      <div className="space-y-2 p-3">
        <div className="flex min-h-8 flex-wrap items-center gap-2 pr-24">
          <p className="text-xs text-white/80">
            {t("orders.headCount", { count: totalItems })} · {shortDateTime(order.created_date, ta)}
          </p>
          <StatusChip order={order} className="flex-none" />
        </div>
        <div className="divide-y divide-white/15">
        {farms.map((farm, farmIndex) => {
          const expanded = expandedFarms.has(farm.key);
          const panelId = `order-farm-${accordionId}-${farmIndex}`;
          return (
            <section key={farm.key} className="min-w-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFarm(farm.key);
                }}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex min-h-9 w-full min-w-0 items-center gap-2 px-1 py-1.5 text-left"
              >
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-white">{farm.name}</h3>
                <span className="flex-none text-[11px] font-semibold text-white/70">
                  {t("orders.itemCount", { count: farm.items.length })}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 flex-none text-[#E3C19F] transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
              <div
                id={panelId}
                aria-hidden={!expanded}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0 pointer-events-none"}`}
              >
                <div className="min-h-0 overflow-hidden">
                <div className="space-y-1.5 px-1 pb-2 pt-1">
                  {farm.items.map((item, index) => (
                    <button
                      key={item.id || item.livestock_id || item.bulk_listing_id || index}
                      type="button"
                      disabled={!item.livestock_id && !item.livestockId && !item.bulk_listing_id && !item.bulkListingId}
                      onClick={(event) => {
                        event.stopPropagation();
                        const isBulkItem = item.item_type === "bulk" || (!item.livestock_id && !item.livestockId && Boolean(item.bulk_listing_id || item.bulkListingId));
                        const productId = isBulkItem
                          ? item.bulk_listing_id || item.bulkListingId
                          : item.livestock_id || item.livestockId;
                        if (!productId) return;
                        const productPath = isBulkItem
                          ? `/bulk-buy/${encodeURIComponent(productId)}?from=order`
                          : `/livestock/${encodeURIComponent(productId)}?from=order`;
                        navigateFromProductCard(productPath, event.currentTarget, {
                          image: accountMediaUrl(item.image),
                          label: item.breed || item.listing_name || t("orders.fallbackItemName"),
                        });
                      }}
                      className="grid w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)_6.5rem] items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F] disabled:cursor-default"
                    >
                      <OrderThumb item={item} size="h-12 w-12" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-xs font-semibold leading-snug text-white">
                          {item.breed || item.listing_name || t("orders.fallbackItemName")}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/65">×{Number(item.quantity) || 1}</p>
                      </div>
                      <p className="whitespace-nowrap text-right text-xs font-bold tabular-nums text-white">
                        {formatRM(item.price_per_head ?? item.unitPrice ?? item.price ?? item.total)}
                      </p>
                    </button>
                  ))}
                </div>
                </div>
              </div>
            </section>
          );
        })}
        </div>
      </div>

      {reservedUntil && (
        <div className="mx-3 mb-1.5 flex items-center gap-1.5 rounded-lg bg-[#FDF0D5] px-2.5 py-1.5 text-[11px] font-semibold leading-tight text-[#7A4B00]">
          <Clock3 className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span>
            {reservedUntil}. {t("orders.reservation.retryHint")}
          </span>
        </div>
      )}

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="mr-auto">
            <p className="text-xs text-white/70">{ta("orders.total")}</p>
            <p className="text-base font-bold leading-tight text-white">
              {formatRM(order.total)}
            </p>
          </div>
          {!isPending && (
            <Link
              to={primary.to}
              onClick={(event) => event.stopPropagation()}
              className={`${lightBtn} min-h-10 px-3 text-xs`}
            >
              {primary.label}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        {isPending && (
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCancel(order);
              }}
              disabled={cancelling}
              className={`${ghostOnDarkBtn} !min-h-9 !rounded-lg !px-2 !text-xs`}
            >
              {cancelling ? t("orders.cancelling") : t("orders.cancelOrder")}
            </button>
            <Link
              to={primary.to}
              onClick={(event) => event.stopPropagation()}
              className={`${lightBtn} !min-h-9 !gap-1 !rounded-lg !px-2 !text-xs`}
            >
              {primary.label}
              <ChevronRight className="h-4 w-4 flex-none" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Orders() {
  const { requestSignIn } = useAuthPrompt();
  const { t } = useTranslation("orders");
  const { t: ta } = useTranslation("account");
  const { user, isAuthenticated, authChecked } = useAuth();
  const navigate = useNavigate();
  const { navigateWithTransition } = useHeaderTransition();
  const { reveal } = useReveal();
  const [activeTab, setActiveTab] = useState(() => {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    const savedTab = sessionStorage.getItem("gh_orders_active_tab");
    if (ORDER_TABS.some((tab) => tab.key === queryTab)) return queryTab;
    return ORDER_TABS.some((tab) => tab.key === savedTab) ? savedTab : "to-pay";
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [cancelError, setCancelError] = useState("");

  const loadOrders = useCallback(async () => {
    if (!authChecked) return;
    if (!isAuthenticated || !user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await qurbiApi.functions.invoke("fetchMyOrders", {});
      setOrders(response.data?.orders || []);
    } catch {
      setError(t("orders.loadError"));
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  useEffect(() => {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    if (ORDER_TABS.some((tab) => tab.key === queryTab))
      navigate("/orders", { replace: true });
  }, [navigate]);
  useEffect(() => {
    sessionStorage.setItem("gh_orders_active_tab", activeTab);
  }, [activeTab]);

  const cancelOrder = async () => {
    const orderId = cancelCandidate?.id;
    if (!orderId || cancellingOrderId) return;
    const cancelIds = cancelCandidate.order_ids || [orderId];
    setCancellingOrderId(orderId);
    setCancelError("");
    try {
      const responses = await Promise.all(
        cancelIds.map((id) =>
          qurbiApi.functions.invoke("cancelMyOrder", { orderId: id }),
        ),
      );
      const cancelledOrders = responses.map((response) => response.data?.order);
      setOrders((current) =>
        current.map((order) => {
          const index = cancelIds.indexOf(order.id);
          return index >= 0
            ? { ...order, ...cancelledOrders[index], status: "cancelled" }
            : order;
        }),
      );
      setCancelCandidate(null);
      setSuccessMessage(t("orders.cancelSuccess"));
      setTimeout(() => setSuccessMessage(""), 3000);
      await loadOrders();
    } catch (error) {
      setCancelError(
        error.data?.error ||
          error.message ||
          t("orders.cancelErrorFallback"),
      );
      // The server may have detected a stock change while cancellation was open.
      await loadOrders();
    } finally {
      setCancellingOrderId("");
    }
  };
  const ordersByTab = useMemo(() => {
    const byTab = {};
    for (const order of orders) {
      const status = orderStatusInfo(order);
      // Final outcomes belong to Transaction History, not the active Orders page.
      if (["completed", "cancelled", "outOfStock", "refunded"].includes(status.key)) continue;
      const tab = status.tab;
      (byTab[tab] ||= []).push(order);
    }
    // Orders created by one multi-farmer checkout are shown as one entry.
    return Object.fromEntries(
      Object.entries(byTab).map(([tab, list]) => [tab, groupOrdersByCheckout(list)]),
    );
  }, [orders]);
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ordersByTab).map(([tab, list]) => [tab, list.length]),
      ),
    [ordersByTab],
  );
  const active = ORDER_TABS.find((tab) => tab.key === activeTab) || ORDER_TABS[0];
  const visibleOrders = useMemo(
    () => ordersByTab[active.key] || [],
    [active, ordersByTab],
  );
  const groupedOrders = useMemo(
    () => groupOrdersByDay(visibleOrders, ta),
    [visibleOrders, ta],
  );

  if (!authChecked) {
    return (
      <div className="aisyah-page">
        <AppHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
        <PageLoading contentOnly message={t("orders.loadingOrders")} />
      </div>
    );
  }

  if (authChecked && !isAuthenticated)
    return (
      <div className="aisyah-page min-h-screen">
        <AppHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
        <div className="aisyah-content flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ReceiptText className="h-12 w-12 text-[#41362D]/40" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[#41362D]">{ta("orders.guestTitle")}</h2>
          <p className="max-w-xs text-[15px] leading-relaxed text-[#41362D]/75">{t("orders.signInPrompt")}</p>
          <button
            type="button"
            onClick={() => requestSignIn({ returnTo: "/orders", message: t("orders.signInMessage") })}
            className={`${primaryBtn} mt-2 px-8`}
          >
            {t("orders.signIn")}
          </button>
        </div>
      </div>
    );

  return (
    <div className="aisyah-page">
      <AppHeader
        sticky
        title={t("orders.title")}
        subtitle={t("orders.subtitle")}
        leftAction={
          <TransactionHeaderButton onOpen={() => navigateWithTransition("/transaction-history")} />
        }
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <div className="horizontal-filter-scroll no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max gap-1 pr-1" role="tablist" aria-label={t("orders.title")}>
              {ORDER_TABS.map((tab) => {
                const count = tabCounts[tab.key] || 0;
                const selected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveTab(tab.key);
                    }}
                    className={`flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-bold transition-colors ${selected ? "bg-[#E3C19F] text-[#41362D]" : "bg-white/10 text-white"}`}
                  >
                    {t(tab.labelKey)}
                    {count > 0 && (
                      <span
                        className={`flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold ${selected ? "bg-[#41362D] text-white" : "bg-white/20 text-white"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </AppHeader>
      {successMessage && (
        <div
          role="status"
          className="fixed left-4 right-4 top-5 z-40 rounded-xl bg-[#41362D] px-4 py-3 text-[15px] font-semibold text-white shadow-lg"
        >
          {successMessage}
        </div>
      )}
      <main className="aisyah-content mx-auto max-w-3xl space-y-2">
        {loading && !orders.length ? (
          <PageLoading contentOnly message={t("orders.loadingOrders")} />
        ) : (
          <>
            {error ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#E3C19F] bg-[#FFFDF9] px-5 py-10 text-center">
                <p className="text-[15px] font-semibold text-[#41362D]">{error}</p>
                <button type="button" onClick={loadOrders} className={`${primaryBtn} px-8`}>
                  {t("orders.retry")}
                </button>
              </div>
            ) : groupedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E3C19F] bg-[#FFFDF9]/80 px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F7EDE2]">
                  <Package className="h-8 w-8 text-[#6B594A]" aria-hidden="true" />
                </div>
                <p className="text-base font-bold text-[#41362D]">{t("orders.emptyTitle")}</p>
                <p className="max-w-xs text-[15px] leading-relaxed text-[#41362D]/75">
                  {ta(`orders.empty.${active.key}`)}
                </p>
                <Link to="/browse" className={`${primaryBtn} mt-1 px-6`}>
                  {ta("orders.browseLivestock")}
                </Link>
              </div>
            ) : (
              groupedOrders.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center gap-2" aria-label={group.label}>
                    <span className="h-px min-w-0 flex-1 bg-[#6B594A]/25" aria-hidden="true" />
                    <h2 className="flex-none text-center text-xs font-bold leading-none text-[#41362D]/75">
                      {group.label}
                    </h2>
                    <span className="h-px min-w-0 flex-1 bg-[#6B594A]/25" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    {group.orders.map((order, index) => (
                      <div
                        key={order.id}
                        className={reveal()}
                        style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                      >
                        <OrderCard
                          order={order}
                          onCancel={(candidate) => {
                            setCancelError("");
                            setCancelCandidate(candidate);
                          }}
                          cancelling={cancellingOrderId === order.id}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </main>
      <CancelOrderModal
        order={cancelCandidate}
        loading={!!cancellingOrderId}
        error={cancelError}
        onConfirm={cancelOrder}
        onClose={() => {
          setCancelError("");
          setCancelCandidate(null);
        }}
      />
    </div>
  );
}
