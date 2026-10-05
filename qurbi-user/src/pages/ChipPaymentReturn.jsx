import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleX, Clock3, RotateCw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { qurbiApi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { QurbiPageLoader } from "@/components/QurbiLoading";

const MAX_CONFIRMATION_ATTEMPTS = 20;

export default function ChipPaymentReturn() {
  const { result = "success" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const paymentSessionId = searchParams.get("payment_session_id") || "";
  const fallbackOrderIds = searchParams.get("order_ids") || "";

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !paymentSessionId) return undefined;
    let active = true;
    let timer;
    (async () => {
      try {
        const response = await qurbiApi.functions.invoke("fetchChipPaymentSession", {
          paymentSessionId,
        });
        if (!active) return;
        const current = response.data?.payment;
        setPayment(current);
        setError("");
        const orderIds = current?.order_ids || current?.orderIds || [];
        if (current?.status === "paid") {
          navigate(
            `/receipt?payment_session_id=${encodeURIComponent(paymentSessionId)}&order_ids=${encodeURIComponent(orderIds.join(","))}`,
            { replace: true },
          );
          return;
        }
        if (result === "success" && attempt < MAX_CONFIRMATION_ATTEMPTS) {
          timer = window.setTimeout(() => setAttempt((value) => value + 1), 1500);
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to confirm this payment.");
      }
    })();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [attempt, authChecked, isAuthenticated, navigate, paymentSessionId, result]);

  const orderIds = useMemo(() => {
    const values = payment?.order_ids || payment?.orderIds;
    return Array.isArray(values) && values.length ? values.join(",") : fallbackOrderIds;
  }, [fallbackOrderIds, payment]);
  const retryUrl = orderIds
    ? `/payment?order_ids=${encodeURIComponent(orderIds)}`
    : "/orders";

  if (!authChecked) return <QurbiPageLoader label="Checking your payment…" />;
  if (!isAuthenticated) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    return <PaymentState
      icon={Clock3}
      title="Sign in to confirm payment"
      message="Your payment status is stored securely. Sign in with the same buyer account to continue."
      action={<Link className="qurbi-primary-button block text-center" to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>}
    />;
  }
  if (!paymentSessionId) {
    return <PaymentState icon={CircleX} title="Invalid payment return" message="The payment session ID is missing." action={<Link className="qurbi-primary-button block text-center" to="/orders">My Orders</Link>} />;
  }
  if (result === "success" && !error && attempt < MAX_CONFIRMATION_ATTEMPTS) {
    return <QurbiPageLoader label="Confirming payment with CHIP…" />;
  }

  const cancelled = result === "cancelled" || result === "cancel";
  const title = error
    ? "Payment confirmation unavailable"
    : cancelled
      ? "Payment cancelled"
      : result === "failed"
        ? "Payment was not completed"
        : "Payment is still processing";
  const message = error || (cancelled
    ? "No payment was confirmed. Your reserved livestock remains in My Orders while the reservation is active."
    : result === "failed"
      ? "CHIP could not complete the payment. You can retry using the same reserved order."
      : "The bank return arrived before the signed webhook. Check again shortly; QURBI will never mark an order paid from the redirect alone.");

  return <PaymentState
    icon={result === "success" ? CheckCircle2 : CircleX}
    title={title}
    message={message}
    action={
      <div className="grid gap-3">
        {result === "success" && (
          <button type="button" onClick={() => setAttempt(0)} className="qurbi-primary-button flex items-center justify-center gap-2">
            <RotateCw className="h-4 w-4" /> Check payment again
          </button>
        )}
        <Link className="rounded-xl border border-[#6B594A] px-4 py-3 text-center text-sm font-bold text-[#41362D]" to={retryUrl}>
          {result === "success" ? "View payment order" : "Try payment again"}
        </Link>
        <Link className="text-center text-sm font-semibold text-[#6B594A]" to="/orders">My Orders</Link>
      </div>
    }
  />;
}

function PaymentState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7EDE2] p-5">
      <div className="w-full max-w-sm rounded-3xl border border-[#E3C19F] bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E3C19F]/45 text-[#41362D]">
          <Icon className="h-9 w-9" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-[#41362D]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6B594A]">{message}</p>
        <div className="mt-6">{action}</div>
      </div>
    </div>
  );
}
