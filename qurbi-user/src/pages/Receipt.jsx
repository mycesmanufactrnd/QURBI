import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Home, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { GRADE_COLORS } from "@/lib/livestock-data";
import { useReveal } from "@/hooks/useReveal";
import { QurbiPageLoader } from "@/components/QurbiLoading";

const ANIMAL_EMOJIS = {
  Cow: "🐄",
  Lamb: "🐑",
  Goat: "🐐",
  Buffalo: "🐃",
  Camel: "🐪",
};

export default function Receipt() {
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const { reveal } = useReveal();
  const { user, isAuthenticated, authChecked } = useAuth();

  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setLoadError("");
      try {
        if (orderId && isAuthenticated && user?.id) {
          const response = await base44.functions.invoke("fetchMyOrders", {
            orderId,
          });
          let o = response.data?.order;
          if (!o) return;
          // Verify payment server-side, then idempotently reserve the livestock
          // and notify each farmer. Re-running this function is safe after refresh.
          const confirmation = await base44.functions.invoke(
            "markPurchasedLivestock",
            { orderId, sessionId },
          );
          setOrder(
            confirmation.data?.order || {
              ...o,
              status: "paid",
              stripe_session_id: sessionId || o.stripe_session_id || "",
            },
          );
        }
      } catch (e) {
        console.error(e);
        setLoadError(
          e.data?.error || e.message || "We couldn't load your receipt.",
        );
      } finally {
        setLoading(false);
      }
    };
    if (authChecked) fetchOrder();
  }, [
    authChecked,
    isAuthenticated,
    orderId,
    retryToken,
    sessionId,
    user?.id,
  ]);

  if (loading) {
    return <QurbiPageLoader label="Loading your receipt…" />;
  }

  if (loadError) {
    return (
      <div className="qurbi-page flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="max-w-sm text-sm text-[#41362D]/65">{loadError}</p>
        <button
          type="button"
          onClick={() => setRetryToken((value) => value + 1)}
          className="qurbi-primary-button"
        >
          Retry
        </button>
        <Link to="/orders" className="text-sm font-bold text-[#6B594A]">
          Back to My Orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-emerald-300">Order not found.</p>
        <Link to="/" className="text-emerald-400 underline">
          Go Home
        </Link>
      </div>
    );
  }

  const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 pb-10">
      {/* Success Banner */}
      <div
        className={`bg-emerald-500 px-4 py-8 flex flex-col items-center gap-3 ${reveal()}`}
      >
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-white font-bold text-2xl">Payment Confirmed!</h1>
        <p className="text-emerald-100 text-sm text-center">
          Your livestock order has been placed successfully
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Order Info */}
        <div
          className={`bg-green-900/60 border border-emerald-700/40 rounded-2xl p-4 space-y-3 ${reveal()}`}
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-sm">Order Number</span>
            <span className="text-emerald-100 font-bold">
              {order.order_number}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-sm">Buyer</span>
            <span className="text-emerald-100">{order.buyer_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-sm">Email</span>
            <span className="text-emerald-100 text-sm">
              {order.buyer_email}
            </span>
          </div>
          {order.buyer_phone && (
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 text-sm">Phone</span>
              <span className="text-emerald-100">{order.buyer_phone}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-sm">Status</span>
            <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              ✓ PAID
            </span>
          </div>
        </div>

        {/* Items */}
        <div
          className={`bg-green-900/60 border border-emerald-700/40 rounded-2xl p-4 ${reveal()}`}
          style={{ animationDelay: "140ms" }}
        >
          <h3 className="text-emerald-100 font-bold mb-3">
            Order Items ({totalItems} head)
          </h3>
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between border-b border-emerald-800/40 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span>{ANIMAL_EMOJIS[item.animal] || "🐾"}</span>
                    <span className="text-emerald-100 font-semibold text-sm">
                      {item.breed}
                    </span>
                    {item.grade && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[item.grade]}`}
                      >
                        {item.grade}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-400 text-xs mt-0.5">
                    {item.quantity} seekor × RM{" "}
                    {item.price_per_head?.toLocaleString()} | ⚖️{" "}
                    {item.weight_min}–{item.weight_max} kg
                  </p>
                </div>
                <span className="text-emerald-100 font-bold text-sm">
                  RM {item.total?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-emerald-700/40 pt-3 mt-1 flex justify-between font-bold">
            <span className="text-emerald-100">Total Paid</span>
            <span className="text-emerald-400 text-xl">
              RM {order.total?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          className={`grid grid-cols-2 gap-3 ${reveal()}`}
          style={{ animationDelay: "200ms" }}
        >
          <Link
            to="/"
            className="bg-green-800/60 border border-emerald-700/40 text-emerald-300 py-3 rounded-xl font-semibold text-center flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Home
          </Link>
          <Link
            to="/history"
            className="bg-emerald-400 text-green-950 py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" /> History
          </Link>
        </div>
      </div>
    </div>
  );
}
