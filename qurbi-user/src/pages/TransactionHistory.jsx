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
import { useTranslation } from "react-i18next";

const TRANSACTION_STATUSES = new Set([
  "completed",
  "received",
  "refunded",
  "cancelled",
  "out_of_stock",
]);

const STATUS_KEYS = {
  completed: "completed",
  delivered: "completed",
  received: "completed",
  refunded: "refunded",
  cancelled: "cancelled",
  out_of_stock: "outOfStock",
};

const DATE_KEYS = {
  January: "jan",
  February: "feb",
  March: "march",
  April: "april",
  May: "may",
  June: "june",
  July: "july",
  August: "aug",
  September: "sep",
  October: "oct",
  November: "nov",
  December: "dec",
};

function normalizedTransactionStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function transactionStatusLabel(order, t) {
  const orders = order.grouped_orders?.length ? order.grouped_orders : [order];
  const labels = [
    ...new Set(
      orders
        .map((item) => normalizedTransactionStatus(item.status))
        .filter((status) => TRANSACTION_STATUSES.has(status))
        .map((status) => t(`statuses.${STATUS_KEYS[status]}`, { defaultValue: status })),
    ),
  ];
  return labels.join(" / ") || t("statuses.completed");
}

function transactionDateText(t, key, fallback) {
  const dateEntries = t("date", { returnObjects: true, defaultValue: [] });
  if (!Array.isArray(dateEntries)) return fallback;
  const match = dateEntries.find((entry) => entry && Object.hasOwn(entry, key));
  return match?.[key] || fallback;
}

function transactionDayHeading(createdDate, t) {
  const heading = orderDayHeading(createdDate);
  if (heading === "Today") return transactionDateText(t, "today", heading);
  if (heading === "Yesterday") return t("yesterday", { defaultValue: heading });
  if (heading === "Date unavailable") return t("dateUnavailable", { defaultValue: heading });
  const month = Object.keys(DATE_KEYS).find((englishMonth) => heading.includes(englishMonth));
  if (!month) return heading;
  return heading.replace(month, transactionDateText(t, DATE_KEYS[month], month));
}

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
        style={
          scrollDistance > 2
            ? /** @type {React.CSSProperties} */ ({ "--scroll-distance": `-${scrollDistance}px` })
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}

function groupTransactions(orders, t) {
  return groupOrdersByCheckout(
    orders.filter((order) => TRANSACTION_STATUSES.has(normalizedTransactionStatus(order.status))),
  )
    .sort((a, b) => orderTimestamp(b.created_date) - orderTimestamp(a.created_date))
    .reduce((groups, order) => {
      const key = orderDateKey(order.created_date);
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.orders.push(order);
      else groups.push({ key, label: transactionDayHeading(order.created_date, t), orders: [order] });
      return groups;
    }, []);
}

function orderFarmName(order, t) {
  const farms = [
    ...new Set(
      [order.farm_name, order.farmName, ...(order.items || []).map((item) => item.farm_name || item.farmName)]
        .filter(Boolean),
    ),
  ];
  if (!farms.length) return t("farmUnavailable");
  if (farms.length <= 2) return farms.join(" & ");
  return t("moreFarms", { name: farms[0], count: farms.length - 1 });
}

export default function TransactionHistory() {
  const { t } = useTranslation("transaction");
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
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, t, user?.id]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  const groups = useMemo(() => groupTransactions(orders, t), [orders, t]);

  if (!authChecked) {
    return <div className="aisyah-page"><AppHeader title={t("title")} backTo="/orders" /><PageLoading contentOnly message={t("loading")} /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="aisyah-page min-h-screen pb-28">
        <AppHeader title={t("title")} backTo="/orders" />
        <div className="aisyah-content flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><ReceiptText className="h-10 w-10 text-gray-300" /></div>
          <p className="text-sm text-[#41362D]/65">{t("signInPrompt")}</p>
          <button type="button" onClick={() => requestSignIn({ returnTo: "/transaction-history", message: t("signInMessage") })} className="mt-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-3 text-sm font-bold text-white">{t("signIn")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aisyah-page">
      <AppHeader title={t("title")} backTo="/orders" />
      <main className="aisyah-content space-y-5">
        {loading ? <PageLoading contentOnly message={t("loading")} /> : error ? (
          <div className="py-16 text-center"><p className="text-sm text-gray-500">{error}</p><button type="button" onClick={loadTransactions} className="mt-3 text-sm font-bold text-[#5A493C]">{t("retry")}</button></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100"><PackageCheck className="h-10 w-10 text-gray-300" /></div><p className="font-semibold text-gray-600">{t("empty")}</p></div>
        ) : groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#6B594A]">{group.label}</h2>
            <div className="overflow-hidden rounded-2xl border border-[#E3C19F]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20">
              <div className="grid grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 border-b border-white/15 px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                <span className="text-left">{t("columns.farm")}</span><span className="text-center">{t("columns.status")}</span><span className="justify-self-end">{t("columns.total")}</span>
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
                    navigateWithTransition(`/orders/${encodeURIComponent(order.id)}?fromTab=transaction-history${groupSuffix}`);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_4.25rem_minmax(6.25rem,auto)] items-center gap-2 border-b border-white/10 px-4 py-3 text-right transition-colors last:border-b-0 hover:bg-white/5"
                >
                  <span className="min-w-0 text-left">
                    <ScrollingFarmName className="text-sm font-extrabold text-white">
                      {orderFarmName(order, t)}
                    </ScrollingFarmName>
                    <span className="mt-0.5 block text-xs font-semibold text-white/60">{formatOrderTime(order.created_date)}</span>
                  </span>
                  <span className="max-w-full justify-self-center rounded-full bg-[#F7EDE2] px-1.5 py-1 text-center text-[10px] font-extrabold leading-tight text-[#41362D] sm:text-[11px]">{transactionStatusLabel(order, t)}</span>
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
