import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Package, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { qurbiApi } from "@/api/qurbiClient";
import AppHeader from "@/components/AppHeader";
import CancelOrderModal from "@/components/CancelOrderModal";
import PageLoading from "@/components/PageLoading";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import {
  formatOrderTime,
  orderDateKey,
  orderDayHeading,
  orderTimestamp,
} from "@/lib/order-date";
import { groupedOrderQuery, groupOrdersByCheckout } from "@/lib/order-groups";

const TABS = [
  { key: "to-pay", label: "To Pay", statuses: ["pending", "pending_payment", "to_pay"] },
  { key: "to-ship", label: "To Ship", statuses: ["paid", "preparing", "to_ship", "processing"] },
  { key: "to-receive", label: "To Receive", statuses: ["in_transit", "shipped", "to_receive", "delivering"] },
  { key: "return-refund", label: "Return / Refund", statuses: ["return_requested", "refund_requested", "return_refund"] },
];

const STATUS_LABELS = {
  pending: "To Pay",
  pending_payment: "To Pay",
  to_pay: "To Pay",
  paid: "To Ship",
  preparing: "To Ship",
  to_ship: "To Ship",
  processing: "To Ship",
  in_transit: "To Receive",
  shipped: "To Receive",
  to_receive: "To Receive",
  delivering: "To Receive",
  return_requested: "Return Requested",
  refund_requested: "Refund Requested",
  return_refund: "Return / Refund",
};

function ScrollingFarmName({ children, className = "" }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const containerWidth = containerRef.current?.clientWidth || 0;
      const textWidth = textRef.current?.scrollWidth || 0;
      setScrollDistance(Math.max(0, textWidth - containerWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    if (textRef.current) observer.observe(textRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  return (
    <span ref={containerRef} className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${scrollDistance > 2 ? "product-name-scroll" : ""}`}
        style={scrollDistance > 2 ? { "--scroll-distance": `-${scrollDistance}px` } : undefined}
      >
        {children}
      </span>
    </span>
  );
}

function groupOrdersByDay(orders) {
  return [...orders]
    .sort((a, b) => orderTimestamp(b.created_date) - orderTimestamp(a.created_date))
    .reduce((groups, order) => {
      const key = orderDateKey(order.created_date);
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.orders.push(order);
      else groups.push({ key, label: orderDayHeading(order.created_date), orders: [order] });
      return groups;
    }, []);
}

function orderFarmName(order) {
  const farms = [
    ...new Set(
      [order.farm_name, order.farmName, ...(order.items || []).map((item) => item.farm_name || item.farmName)]
        .filter(Boolean),
    ),
  ];
  if (!farms.length) return "Farm unavailable";
  if (farms.length <= 2) return farms.join(" & ");
  return `${farms[0]} + ${farms.length - 1} farms`;
}

function reservationLabel(order) {
  if (!order.reservation_expires_at || order.reservation_status !== "active") return "";
  const expiresAt = new Date(order.reservation_expires_at);
  if (Number.isNaN(expiresAt.getTime())) return "Reserved for 24 hours";
  return `Reserved until ${new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(expiresAt)}`;
}

function OrderTable({ group, onOpen, onCancel, cancellingOrderId }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#6B594A]">
        {group.label}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#E3C19F]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20">
        <div className="grid grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 border-b border-white/15 px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
          <span className="text-left">Farm</span>
          <span className="text-center">Status</span>
          <span className="justify-self-end">Total</span>
        </div>
        {group.orders.map((order) => {
          const isPending = ["pending", "pending_payment", "to_pay"].includes(order.status);
          const reservedUntil = isPending ? reservationLabel(order) : "";
          const sourceTab = TABS.find((tab) => tab.statuses.includes(order.status))?.key || "";
          const groupIds = order.order_ids || [order.id];
          const groupSuffix = groupIds.length > 1
            ? `&group_ids=${encodeURIComponent(groupIds.join(","))}`
            : "";
          const itemCount = (order.items || []).reduce(
            (total, item) => total + Math.max(1, Number(item.quantity || 1)),
            0,
          );
          const detailsPath = `/orders/${encodeURIComponent(order.id)}?fromTab=${encodeURIComponent(sourceTab)}${groupSuffix}`;
          return (
            <div key={order.id} className="border-b border-white/10 px-4 py-3 last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(detailsPath)}
                className="grid w-full grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 text-right transition-opacity hover:opacity-90"
              >
                <span className="min-w-0 text-left">
                  <ScrollingFarmName className="text-sm font-extrabold text-white">
                    {orderFarmName(order)}
                  </ScrollingFarmName>
                </span>
                <span className="max-w-full justify-self-center rounded-full bg-[#F7EDE2] px-1.5 py-1 text-center text-[10px] font-extrabold leading-tight text-[#41362D] sm:text-[11px]">
                  {STATUS_LABELS[order.status] || order.status}
                </span>
                <span className="min-w-0 justify-self-end whitespace-nowrap text-sm font-extrabold leading-tight text-white">
                  RM {Number(order.total || 0).toLocaleString()}
                </span>
              </button>
              <div className="mt-2 flex items-end justify-between gap-3 text-xs font-semibold">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left text-white/65">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 flex-none" />
                    {formatOrderTime(order.created_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 flex-none" />
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>

                {reservedUntil && (
                  <span className="text-right text-[#F7EDE2]">
                    {reservedUntil}
                  </span>
                )}
              </div>
              <div className={`mt-3 border-t border-white/10 pt-3 ${isPending ? "grid grid-cols-2 gap-2" : "flex justify-end"}`}>
                {isPending && (
                  <button
                    type="button"
                    onClick={() => onCancel(order)}
                    disabled={cancellingOrderId === order.id}
                    className="flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200/70 bg-gradient-to-br from-[#EF4444] to-[#B91C1C] px-3 py-2 text-center text-xs font-bold text-white shadow-sm shadow-red-950/25 disabled:opacity-50"
                  >
                    {cancellingOrderId === order.id ? "Cancelling..." : "Cancel"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpen(isPending ? `/payment?${groupedOrderQuery(order)}` : detailsPath)}
                  className={`flex min-h-10 items-center justify-center rounded-lg border border-[#F7EDE2]/70 bg-white/10 px-3 py-2 text-center text-xs font-bold text-white ${isPending ? "w-full" : ""}`}
                >
                  {isPending ? "Continue Payment" : "View Order"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TransactionHeaderButton({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Transaction History"
      className="flex h-10 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 px-3 text-xs font-bold text-white transition-transform active:scale-90"
    >
      Transaction
    </button>
  );
}

export default function Orders() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const { requestSignIn } = useAuthPrompt();
  const { navigateWithTransition } = useHeaderTransition();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    const savedTab = sessionStorage.getItem("gh_orders_active_tab");
    if (TABS.some((tab) => tab.key === queryTab)) return queryTab;
    return TABS.some((tab) => tab.key === savedTab) ? savedTab : "to-pay";
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");

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
      setError("We couldn't load your orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, user?.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { sessionStorage.setItem("gh_orders_active_tab", activeTab); }, [activeTab]);
  useEffect(() => {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((tab) => tab.key === queryTab)) navigate("/orders", { replace: true });
  }, [navigate]);

  const active = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  const groupedOrders = useMemo(
    () => groupOrdersByDay(groupOrdersByCheckout(
      orders.filter((order) => active.statuses.includes(order.status)),
    )),
    [active, orders],
  );

  const cancelOrder = async () => {
    const orderId = cancelCandidate?.id;
    if (!orderId || cancellingOrderId) return;
    setCancellingOrderId(orderId);
    setCancelError("");
    try {
      await Promise.all(
        (cancelCandidate.order_ids || [orderId]).map((id) =>
          qurbiApi.functions.invoke("cancelMyOrder", { orderId: id }),
        ),
      );
      setCancelCandidate(null);
      await loadOrders();
    } catch (cancelFailure) {
      setCancelError(cancelFailure.data?.error || cancelFailure.message || "We couldn't cancel this order. Please try again.");
    } finally {
      setCancellingOrderId("");
    }
  };

  if (!authChecked) {
    return <div className="aisyah-page"><AppHeader title="My Orders" /><PageLoading contentOnly message="Loading orders..." /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="aisyah-page min-h-screen pb-28">
        <AppHeader title="My Orders" />
        <div className="aisyah-content flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><ReceiptText className="h-10 w-10 text-gray-300" /></div>
          <p className="text-sm text-[#41362D]/65">Sign in to view your orders.</p>
          <button type="button" onClick={() => requestSignIn({ returnTo: "/orders", message: "Sign in to view and manage your orders." })} className="mt-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-3 text-sm font-bold text-white">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aisyah-page">
      <AppHeader
        sticky
        title="My Orders"
        leftAction={<TransactionHeaderButton onOpen={() => navigateWithTransition("/history")} />}
      >
        <div className="space-y-2">
          <div className="horizontal-filter-scroll no-scrollbar overflow-x-auto">
            <div className="flex min-w-max justify-center gap-1">
              {TABS.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap ${activeTab === tab.key ? "bg-[#E3C19F] text-[#41362D]" : "bg-white/10 text-white/80"}`}>{tab.label}</button>
              ))}
            </div>
          </div>
        </div>
      </AppHeader>
      <main className="aisyah-content space-y-5">
        {loading ? <PageLoading contentOnly message="Loading orders..." /> : error ? (
          <div className="py-16 text-center"><p className="text-sm text-gray-500">{error}</p><button type="button" onClick={loadOrders} className="mt-3 text-sm font-bold text-[#5A493C]">Retry</button></div>
        ) : groupedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><Package className="h-10 w-10 text-gray-300" /></div><p className="font-semibold text-gray-600">No {active.label} orders</p></div>
        ) : groupedOrders.map((group) => (
          <OrderTable key={group.key} group={group} onOpen={navigateWithTransition} onCancel={(order) => { setCancelError(""); setCancelCandidate(order); }} cancellingOrderId={cancellingOrderId} />
        ))}
      </main>
      <CancelOrderModal order={cancelCandidate} loading={Boolean(cancellingOrderId)} error={cancelError} onConfirm={cancelOrder} onClose={() => { setCancelError(""); setCancelCandidate(null); }} />
    </div>
  );
}
