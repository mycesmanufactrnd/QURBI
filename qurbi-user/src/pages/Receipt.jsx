import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle, Home, Clock, MapPin, ReceiptText, ShoppingBag } from "lucide-react";
import { qurbiApi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { GRADE_COLORS } from "@/lib/livestock-data";
import { useReveal } from "@/hooks/useReveal";
import { QurbiPageLoader } from "@/components/QurbiLoading";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import { formatRM } from "@/lib/format";
import { formatOrderDateTime } from "@/lib/order-date";
import StatusChip from "@/components/account/StatusChip";
import { PAID_STATUSES } from "@/components/account/orderStatus";
import { accountMediaUrl } from "@/components/account/media";
import { primaryBtn, secondaryBtn } from "@/components/account/buttons";
import { combineOrders, groupedOrderQuery } from "@/lib/order-groups";
import { recentPageOr } from "@/lib/navigation";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useDisplayMode } from "@/lib/display-mode-context";

const ANIMAL_EMOJIS = {
  Cow: "🐄",
  Lamb: "🐑",
  Goat: "🐐",
  Buffalo: "🐃",
  Camel: "🐪",
};

export default function Receipt() {
  const { t, i18n } = useTranslation("cart");
  const { t: ta } = useTranslation("account");
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const { reveal } = useReveal();
  const { user, isAuthenticated, authChecked } = useAuth();
  const { requestSignIn } = useAuthPrompt();
  const { navigateWithTransition } = useHeaderTransition();
  const { isDesktop } = useDisplayMode();

  const sessionId = searchParams.get("session_id");
  const orderParam = searchParams.get("order_ids") || searchParams.get("order_id") || "";
  const orderIds = orderParam.split(",").map((id) => id.trim()).filter(Boolean);
  const orderId = orderIds[0] || "";

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setLoadError("");
      try {
        if (orderId && isAuthenticated && user?.id) {
          const responses = await Promise.all(
            orderIds.map((id) => qurbiApi.functions.invoke("fetchMyOrders", { orderId: id })),
          );
          const orders = responses.map((response) => response.data?.order).filter(Boolean);
          const o = combineOrders(orders);
          if (!o) return;
          // Verify payment server-side, then idempotently reserve the livestock
          // and notify each farmer. Re-running this function is safe after refresh.
          const confirmations = await Promise.all(
            orderIds.map((id) => qurbiApi.functions.invoke(
              "markPurchasedLivestock",
              { orderId: id, sessionId },
            )),
          );
          setOrder(
            combineOrders(confirmations.map((confirmation) => confirmation.data?.order)) || {
              ...o,
              status: "paid",
              stripe_session_id: sessionId || o.stripe_session_id || "",
            },
          );
        }
      } catch (e) {
        console.error(e);
        setLoadError(
          e.data?.error || e.message || t("receipt.loadReceiptError"),
        );
      } finally {
        setLoading(false);
      }
    };
    if (authChecked) fetchOrder();
  }, [
    authChecked,
    isAuthenticated,
    orderParam,
    retryToken,
    sessionId,
    user?.id,
  ]);

  if (loading) {
    return <QurbiPageLoader label={t("receipt.loadingLabel")} />;
  }

  if (authChecked && !isAuthenticated && orderId) {
    return (
      <ReceiptStateScreen icon={Clock} title={ta("receipt.signInTitle")} message={t("receipt.signInToViewReceipt")}>
        <button
          type="button"
          onClick={() => requestSignIn({ returnTo: window.location.pathname + window.location.search, message: t("receipt.signInToViewThisReceipt") })}
          className={primaryBtn}
        >
          {t("receipt.signIn")}
        </button>
      </ReceiptStateScreen>
    );
  }

  if (loadError) {
    return (
      <ReceiptStateScreen icon={ReceiptText} title={ta("receipt.errorTitle")} message={loadError}>
        <button
          type="button"
          onClick={() => setRetryToken((value) => value + 1)}
          className={primaryBtn}
        >
          {t("receipt.retryButton")}
        </button>
        <Link to="/orders" className={secondaryBtn}>
          {t("receipt.backToMyOrders")}
        </Link>
      </ReceiptStateScreen>
    );
  }

  if (!order) {
    return (
      <ReceiptStateScreen icon={ReceiptText} title={t("receipt.orderNotFound")} message={ta("receipt.notFoundHelp")}>
        <Link to="/orders" className={primaryBtn}>
          {t("receipt.backToMyOrders")}
        </Link>
        <Link to="/" className={secondaryBtn}>
          <Home className="h-4 w-4" aria-hidden="true" /> {t("receipt.goHome")}
        </Link>
      </ReceiptStateScreen>
    );
  }

  const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const paymentComplete =
    order.payment_status === "paid" || PAID_STATUSES.includes(order.status);

  if (!paymentComplete) {
    const reservationDate = new Date(order.reservation_expires_at || "");
    const reservationExpiry = !Number.isNaN(reservationDate.getTime())
      ? new Intl.DateTimeFormat(i18n.language === "ms" ? "ms-MY" : "en-MY", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(reservationDate)
      : t("receipt.reservationFallback");
    return (
      <ReceiptStateScreen
        icon={Clock}
        title={t("receipt.paymentNotCompletedHeading")}
        message={t("receipt.paymentNotCompletedMessage", { expiry: reservationExpiry })}
      >
        <Link
          to={`/payment?${groupedOrderQuery(order)}`}
          className={primaryBtn}
        >
          {t("receipt.continuePayment")}
        </Link>
        <Link to="/orders" className={secondaryBtn}>
          {t("receipt.backToMyOrders")}
        </Link>
      </ReceiptStateScreen>
    );
  }

  const address = order.deliveryAddress || order.delivery_address || {};
  const buyerName = order.buyer_name || address.recipientName || address.name || user?.full_name || "";
  const buyerEmail = order.buyer_email || user?.email || "";
  const buyerPhone = order.buyer_phone || address.recipientPhone || address.phone || user?.phone || "";
  const addressLines = [
    address.street || address.addressLine1,
    address.addressLine2,
    [address.postcode || address.postalCode, address.city].filter(Boolean).join(" "),
    [address.state, address.country].filter(Boolean).join(", "),
  ].filter(Boolean);
  const subtotal = Number(
    order.subtotal ??
      order.items?.reduce((sum, item) => sum + Number(item.total || 0), 0) ??
      0,
  );
  const deliveryFee = Number(order.delivery_fee ?? order.deliveryFee ?? 0);
  const discount = Number(order.discount || 0);
  const rows = [
    [ta("receipt.dateLabel"), formatOrderDateTime(order.paidAt || order.created_date)],
    [t("receipt.buyerLabel"), buyerName],
    [t("receipt.emailLabel"), buyerEmail],
    [t("receipt.phoneLabel"), buyerPhone],
  ].filter(([, value]) => value);

  const receiptDetails = (
    <>
      {/* Order Info */}
      <section
        className={`qurbi-dark-surface h-full rounded-2xl border p-4 shadow-md ${reveal()}`}
        style={{ animationDelay: "80ms" }}
        aria-label={t("receipt.orderInformationLabel")}
      >
        <h2 className="mb-3 text-base font-bold text-white">
          {t("receipt.orderInformationLabel")}
        </h2>
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="flex-none text-sm text-white/75">{label}</dt>
              <dd className="min-w-0 break-words text-right text-[15px] font-semibold text-white [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-white/75">{t("receipt.statusLabel")}</dt>
            <dd className="flex flex-wrap justify-end gap-1.5">
              <StatusChip label={t("receipt.paidBadge")} tone="success" />
              <StatusChip order={order} />
            </dd>
          </div>
        </dl>
      </section>

      {addressLines.length ? (
        <section
          className={`qurbi-dark-surface h-full rounded-2xl border p-4 shadow-md ${reveal()}`}
          style={{ animationDelay: "110ms" }}
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E3C19F]/60 bg-[#E3C19F]/15">
              <MapPin className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            {t("payment.deliveryAddressLabel")}
          </h2>
          <p className="mt-3 break-words text-sm leading-6 text-white/85">
            {addressLines.map((line, index) => (
              <React.Fragment key={`${line}-${index}`}>
                {index > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
          </p>
        </section>
      ) : null}
      

      {/* Items */}
      <section
        className={`qurbi-dark-surface rounded-2xl border p-4 shadow-md ${reveal()}`}
        style={{ animationDelay: "140ms" }}
      >
        <h2 className="mb-2 text-base font-bold text-white">
          {t("receipt.orderItemsHeading", { count: totalItems })}
        </h2>
        <div>
          {order.items?.map((item, idx) => {
            const image = accountMediaUrl(item.image);
            return (
              <div
                key={item.id || idx}
                className="flex items-center gap-3 border-b border-white/15 py-3 last:border-0"
              >
                <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-xl bg-[#F7EDE2] text-xl text-[#6B594A]">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : ANIMAL_EMOJIS[item.animal] ? (
                    <span aria-hidden="true">{ANIMAL_EMOJIS[item.animal]}</span>
                  ) : (
                    <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-[15px] font-semibold text-white">
                      {item.breed || item.listing_name}
                    </span>
                    {item.grade && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${GRADE_COLORS[item.grade]}`}
                      >
                        {item.grade}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-white/75">
                    {ta("receipt.itemLine", { quantity: item.quantity, price: formatRM(item.price_per_head) })}
                    {item.weight_min && item.weight_max ? ` · ${item.weight_min}–${item.weight_max} kg` : ""}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[15px] font-bold text-white">
                  {formatRM(item.total)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 space-y-2 border-t border-white/20 pt-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/75">{ta("orderDetail.summary.subtotal")}</span>
            <span className="font-semibold text-white">{formatRM(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/75">{ta("orderDetail.summary.delivery")}</span>
            <span className="font-semibold text-white">{formatRM(deliveryFee)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-white/75">{ta("orderDetail.summary.discount")}</span>
              <span className="font-semibold text-white">− {formatRM(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 border-t border-white pt-3">
            <span className="font-bold text-white">{t("receipt.totalPaidLabel")}</span>
            <span className="text-2xl font-bold text-white">
              {formatRM(order.total)}
            </span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <Link
        to={`/orders/${encodeURIComponent(order.id)}`}
        className={`${primaryBtn} w-full ${reveal()}`}
        style={{ animationDelay: "200ms" }}
      >
        {ta("receipt.viewOrder")}
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/" className={secondaryBtn}>
          <Home className="h-4 w-4" aria-hidden="true" /> {t("receipt.homeLink")}
        </Link>
        <Link to="/transaction-history" className={secondaryBtn}>
          <Clock className="h-4 w-4" aria-hidden="true" /> {t("receipt.historyLink")}
        </Link>
      </div>
    </>
  );

  return (
    <main
      className={`min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] pb-[max(2.5rem,env(safe-area-inset-bottom))] ${isDesktop ? "px-6 py-7" : ""}`}
    >
      {isDesktop ? (
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <section
            className={`qurbi-header-background relative overflow-hidden rounded-[28px] border border-[#E3C19F]/45 bg-gradient-to-br from-[#41362D] to-[#6B594A] px-10 py-7 text-center text-white shadow-[0_14px_34px_rgba(65,54,45,0.24)] ${reveal()}`}
            aria-label={t("receipt.paymentConfirmedHeading")}
          >
            <button
              type="button"
              onClick={() => navigateWithTransition(recentPageOr("/orders"))}
              aria-label="Return"
              className="absolute left-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-[transform,background-color] hover:-translate-x-0.5 hover:bg-white/20 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F7EDE2]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-md">
              <CheckCircle className="h-9 w-9 text-[#41362D]" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white">
              {t("receipt.paymentConfirmedHeading")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-white/80">
              {t("receipt.orderPlacedMessage")}
            </p>
          </section>

          {receiptDetails}
        </div>
      ) : (
        <>
          {/* Mobile success banner */}
          <header
            className={`qurbi-header-background relative rounded-b-[28px] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-center shadow-lg ${reveal()}`}
          >
            <button
              type="button"
              onClick={() => navigateWithTransition(recentPageOr("/orders"))}
              aria-label="Return"
              className="absolute left-4 top-[max(2rem,env(safe-area-inset-top))] z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-white/10 text-white transition-transform active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F7EDE2]">
                <CheckCircle className="h-10 w-10 text-[#41362D]" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-white">{t("receipt.paymentConfirmedHeading")}</h1>
              <p className="max-w-xs text-[15px] text-white/85">
                {t("receipt.orderPlacedMessage")}
              </p>
            </div>
          </header>

          <div className="mx-auto max-w-lg space-y-4 px-4 pt-5">
            {receiptDetails}
          </div>
        </>
      )}
    </main>
  );
}

/** Centered branded message screen used for every non-receipt state. */
function ReceiptStateScreen({ icon: Icon, title, message, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] p-5">
      <div className="w-full max-w-sm rounded-3xl border border-[#E3C19F] bg-[#FFFDF9] p-6 text-center shadow-xl shadow-[#41362D]/15">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A]">
          <Icon className="h-8 w-8 text-[#E3C19F]" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#41362D]">{title}</h1>
        {message && (
          <p className="mt-2 text-[15px] leading-relaxed text-[#5A493C]">{message}</p>
        )}
        <div className="mt-6 grid gap-3">{children}</div>
      </div>
    </main>
  );
}
