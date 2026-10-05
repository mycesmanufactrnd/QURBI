import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PackageCheck, ReceiptText } from "lucide-react";
import { qurbiApi } from "@/api/qurbiClient";
import AppHeader from "@/components/AppHeader";
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
import { groupOrdersByCheckout } from "@/lib/order-groups";

const TRANSACTION_STATUSES = new Set([
  "completed",
  "delivered",
  "received",
  "refunded",
  "cancelled",
  "out_of_stock",
]);

const STATUS_LABELS = {
  completed: "Completed",
  delivered: "Completed",
  received: "Completed",
  refunded: "Refunded",
  cancelled: "Cancelled",
  out_of_stock: "Out of Stock",
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

function groupTransactions(orders) {
  return groupOrdersByCheckout(
    orders.filter((order) => TRANSACTION_STATUSES.has(order.status)),
  )
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

export default function History() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const { requestSignIn } = useAuthPrompt();
  const { navigateWithTransition } = useHeaderTransition();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
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
      setError("We couldn't load your transaction history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, user?.id]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  const groups = useMemo(() => groupTransactions(orders), [orders]);

  if (!authChecked) {
    return <div className="aisyah-page"><AppHeader title="Transaction History" backTo="/orders" /><PageLoading contentOnly message="Loading transactions..." /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="aisyah-page min-h-screen pb-28">
        <AppHeader title="Transaction History" backTo="/orders" />
        <div className="aisyah-content flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><ReceiptText className="h-10 w-10 text-gray-300" /></div>
          <p className="text-sm text-[#41362D]/65">Sign in to view your transactions.</p>
          <button type="button" onClick={() => requestSignIn({ returnTo: "/history", message: "Sign in to view your transaction history." })} className="mt-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-3 text-sm font-bold text-white">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aisyah-page">
      <AppHeader title="Transaction History" backTo="/orders" />
      <main className="aisyah-content space-y-5">
        {loading ? <PageLoading contentOnly message="Loading transactions..." /> : error ? (
          <div className="py-16 text-center"><p className="text-sm text-gray-500">{error}</p><button type="button" onClick={loadTransactions} className="mt-3 text-sm font-bold text-[#5A493C]">Retry</button></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><PackageCheck className="h-10 w-10 text-gray-300" /></div><p className="font-semibold text-gray-600">No transactions yet</p></div>
        ) : groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#6B594A]">{group.label}</h2>
            <div className="overflow-hidden rounded-2xl border border-[#E3C19F]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20">
              <div className="grid grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 border-b border-white/15 px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                <span className="text-left">Farm</span><span className="text-center">Status</span><span className="justify-self-end">Total</span>
              </div>
              {group.orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    const groupIds = order.order_ids || [order.id];
                    const groupSuffix = groupIds.length > 1
                      ? `&group_ids=${encodeURIComponent(groupIds.join(","))}`
                      : "";
                    navigateWithTransition(`/orders/${encodeURIComponent(order.id)}?fromTab=history${groupSuffix}`);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 border-b border-white/10 px-4 py-3 text-right transition-colors last:border-b-0 hover:bg-white/5"
                >
                  <span className="min-w-0 text-left">
                    <ScrollingFarmName className="text-sm font-extrabold text-white">
                      {orderFarmName(order)}
                    </ScrollingFarmName>
                    <span className="mt-0.5 block text-xs font-semibold text-white/60">{formatOrderTime(order.created_date)}</span>
                  </span>
                  <span className="max-w-full justify-self-center rounded-full bg-[#F7EDE2] px-1.5 py-1 text-center text-[10px] font-extrabold leading-tight text-[#41362D] sm:text-[11px]">{STATUS_LABELS[order.status] || order.status}</span>
                  <span className="min-w-0 justify-self-end whitespace-nowrap text-sm font-extrabold leading-tight text-white">RM {Number(order.total || 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
