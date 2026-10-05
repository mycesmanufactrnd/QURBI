import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  ChevronRight,
  User,
  Phone,
  Mail,
  CreditCard,
  Lock,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAuth } from "@/lib/AuthContext";
import { qurbiApi } from "@/api/qurbiClient";
import { useReveal } from "@/hooks/useReveal";
import {
  availabilityMessage,
  checkCartAvailability,
} from "@/lib/livestock-availability";
import AddressPickerModal from "@/components/AddressPickerModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import PaymentErrorModal from "@/components/PaymentErrorModal";
import ProductImage from "@/components/ProductImage";
import { loadBulkListingById, loadLivestockById } from "@/lib/farmerClient";
import { QurbiPageLoader } from "@/components/QurbiLoading";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import AuthRequiredState from "@/components/AuthRequiredState";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import AppHeader from "@/components/AppHeader";
import StickyActionBar from "@/components/shop/StickyActionBar";
import { formatRM } from "@/lib/format";

const DELIVERY_FEE_PER_FARMER = 10;
const PAYMENT_CARD_SHADOW = "shadow-[0_12px_28px_rgba(65,54,45,0.18)]";

function friendlyPaymentError(error, reservationAlreadyExists = false, t) {
  const status = error?.response?.status;
  const rawMessage = String(
    error?.response?.data?.message || error?.message || "",
  ).toLowerCase();
  const paymentWasDeclined =
    status === 402 ||
    /insufficient|balance|declin|payment failed|payment unsuccessful/.test(
      rawMessage,
    );

  if (paymentWasDeclined) {
    return {
      title: t("payment.errorDeclinedTitle"),
      message: t("payment.errorDeclinedMessage"),
      reserved: true,
    };
  }
  if (status === 409 || /reserved|no longer available/.test(rawMessage)) {
    return {
      title: t("payment.errorUnavailableTitle"),
      message: t("payment.errorUnavailableMessage"),
      reserved: reservationAlreadyExists,
    };
  }
  if (status === 401) {
    return {
      title: t("payment.errorSessionEndedTitle"),
      message: t("payment.errorSessionEndedMessage"),
      reserved: reservationAlreadyExists,
    };
  }
  if (!error?.response || /network|failed to fetch|qurbi server/.test(rawMessage)) {
    return {
      title: t("payment.errorUnreachableTitle"),
      message: t("payment.errorUnreachableMessage"),
      reserved: reservationAlreadyExists,
    };
  }
  return {
    title: t("payment.errorGenericTitle"),
    message: t("payment.errorGenericMessage"),
    reserved: reservationAlreadyExists,
  };
}

function PaymentItemImage({ item, product }) {
  const { t } = useTranslation("cart");
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl =
    item.image ||
    item.coverImage ||
    item.cover_image ||
    item.imageSnapshot ||
    item.image_snapshot ||
    item.images?.[0] ||
    product?.coverImage ||
    product?.images?.[0] ||
    ""
  );
}

function paymentItemLocation(item, product) {
  const location =
    item.farm_location ||
    item.farmLocation ||
    item.farm_address ||
    item.farm_state ||
    product?.farm_location ||
    product?.farmLocation ||
    product?.farm_address ||
    product?.farm_state ||
    product?.farmer?.farmerProfile?.farmState ||
    item.state ||
    product?.state ||
    "";
  return (
    <div
      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md shadow-black/15 ${
        imageUrl && !imageFailed
          ? ""
          : "border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]"
      }`}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="px-1 text-center text-[11px] font-bold leading-tight text-white">
          {t("payment.noImage")}
        </span>
      )}
    </div>
  );
}

export default function Payment() {
  const { t } = useTranslation("cart");
  const { t: tf } = useTranslation("shopflow");
  const { requestSignIn } = useAuthPrompt();
  const {
    selectedItems,
    selectedSubtotal,
    removeSelected,
    buyNowItem,
    clearBuyNow,
  } = useCart();
  const { user, isAuthenticated, authChecked } = useAuth();
  const {
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    profile,
  } = useUserProfile();
  const { navigateWithTransition, navigateFromProductCard } =
    useHeaderTransition();
  const [searchParams] = useSearchParams();
  const { reveal } = useReveal();
  const resumeOrderParam = searchParams.get("order_ids") || searchParams.get("order_id") || "";
  const resumeOrderIds = resumeOrderParam.split(",").map((id) => id.trim()).filter(Boolean);
  const resumeOrderId = resumeOrderIds[0] || "";
  const isBuyNowCheckout = searchParams.get("source") === "buy-now";
  const [resumedOrder, setResumedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(Boolean(resumeOrderId));
  const [resumeError, setResumeError] = useState("");
  const [productDetails, setProductDetails] = useState({});
  const [loadingProductDetails, setLoadingProductDetails] = useState(false);
  const [cancelCandidate, setCancelCandidate] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(resumeOrderId ? 3 : 1);
  const [newCheckoutGroupId] = useState(() =>
    globalThis.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const fulfillmentMethod = "delivery";

  useEffect(() => {
    setCheckoutStep(resumeOrderId ? 3 : 1);
  }, [resumeOrderId]);

  useEffect(() => {
    if (!resumeOrderId) return;
    if (!authChecked) {
      setLoadingOrder(true);
      return;
    }
    let active = true;
    (async () => {
      if (!isAuthenticated || !user?.id) {
        setResumeError(t("payment.signInToLoadOrder"));
        setLoadingOrder(false);
        return;
      }
      setLoadingOrder(true);
      setResumeError("");
      try {
        const response = await qurbiApi.functions.invoke("fetchMyOrders", {
          orderId: resumeOrderId,
        });
        const order = response.data?.order;
        if (!order || !["pending", "pending_payment", "to_pay"].includes(order.status)) {
          if (order?.cancellationReason === "Payment reservation expired") {
            throw new Error(t("payment.reservationExpiredError"));
          }
          throw new Error(t("payment.orderNoLongerAwaitingPayment"));
        }
        if (active) {
          setResumedOrder(order);
          setLoadingProductDetails(Boolean(order.items?.length));
        }
      } catch (error) {
        if (active)
          setResumeError(
            error.message || t("payment.couldNotLoadOrder"),
          );
      } finally {
        if (active) setLoadingOrder(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authChecked, isAuthenticated, resumeOrderParam, user?.id]);

  useEffect(() => {
    if (!resumedOrder?.items?.length) {
      setLoadingProductDetails(false);
      return undefined;
    }
    let active = true;
    Promise.all(
      resumedOrder.items.map(async (item) => {
        try {
          if (item.item_type === "bulk" && item.bulk_listing_id) {
            return await loadBulkListingById(item.bulk_listing_id);
          }
          if (item.livestock_id) return await loadLivestockById(item.livestock_id);
          return null;
        } catch {
          return null;
        }
      }),
    ).then((products) => {
      if (active) {
        setProductDetails(
          Object.fromEntries(
            products.filter(Boolean).map((product) => [product.id, product]),
          ),
        );
        setLoadingProductDetails(false);
      }
    });
    return () => {
      active = false;
    };
  }, [resumedOrder?.id, resumedOrder?.order_ids?.length]);

  const isResumingOrder = resumeOrderIds.length > 0;
  const paymentItems = resumedOrder
    ? (resumedOrder.items || []).map((item, index) => ({
        ...item,
        key: item.livestock_id || `${resumedOrder.id}-${index}`,
        quantity: 1,
        total: item.total ?? item.price_per_head,
      }))
    : isBuyNowCheckout
      ? buyNowItem ? [buyNowItem] : []
      : selectedItems;
  const paymentSubtotal = resumedOrder?.subtotal ?? (
    isBuyNowCheckout ? Number(buyNowItem?.total || 0) : selectedSubtotal
  );

  const buyerName = isResumingOrder
    ? resumedOrder?.buyer_name || ""
    : selectedAddress?.name || profile.name || "";
  const buyerEmail = isResumingOrder
    ? resumedOrder?.buyer_email || ""
    : profile.email || "";
  const buyerPhone = isResumingOrder
    ? resumedOrder?.buyer_phone || ""
    : selectedAddress?.phone || profile.phone || "";

  // A resumed order always belongs to exactly one farmer. A new checkout may
  // contain several farmers, so count each stable farmer identity once. The
  // listing fallback prevents legacy cart rows with missing farmer metadata
  // from being incorrectly collapsed into a single "Unknown Farmer" fee.
  const farmerSet = new Set(
    paymentItems.map((item, index) => {
      const farmerName = String(item.farmer_name || "").trim();
      return (
        item.farmer_id ||
        item.ownerId ||
        item.created_by_id ||
        (farmerName && farmerName !== "Unknown Farmer"
          ? `name:${farmerName.toLowerCase()}`
          : `listing:${item.key || item.livestock_id || item.bulk_listing_id || item.id || index}`)
      );
    }),
  );
  const farmerCount = isResumingOrder
    ? paymentItems.length > 0 ? 1 : 0
    : farmerSet.size;
  const savedDeliveryFee = Number(resumedOrder?.delivery_fee || 0);
  const deliveryFee = isResumingOrder
    ? resumedOrder?.fulfillment_method === "pickup"
      ? 0
      : savedDeliveryFee || farmerCount * DELIVERY_FEE_PER_FARMER
    : paymentItems.length > 0
      ? farmerCount * DELIVERY_FEE_PER_FARMER
      : 0;
  const grandTotal = isResumingOrder
    ? Number(paymentSubtotal) + deliveryFee - Number(resumedOrder?.discount || 0)
    : paymentSubtotal + deliveryFee;

  const canCheckout = isResumingOrder
    ? Boolean(resumedOrder)
    : Boolean(paymentItems.length > 0 && buyerName && buyerEmail && selectedAddress);

  const findReservedOrder = async () => {
    if (isResumingOrder && resumedOrder?.id) return resumedOrder;

    const requestedProducts = new Set(
      paymentItems.map((item) =>
        item.item_type === "bulk"
          ? `bulk:${item.bulk_listing_id || item.id}`
          : `livestock:${item.livestock_id || item.id}`,
      ),
    );

    try {
      const response = await qurbiApi.functions.invoke("fetchMyOrders", {});
      return (response.data?.orders || []).find((order) => {
        if (!["pending", "pending_payment", "to_pay"].includes(order.status)) {
          return false;
        }
        return (order.items || []).some((item) => {
          const key =
            item.item_type === "bulk"
              ? `bulk:${item.bulk_listing_id}`
              : `livestock:${item.livestock_id}`;
          return requestedProducts.has(key);
        });
      });
    } catch {
      return null;
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated || !user?.id) {
      requestSignIn({ returnTo: "/payment", message: t("payment.signInToCheckout") });
      return;
    }
    setCheckoutError(null);
    if (paymentItems.length === 0) {
      setCheckoutError({
        title: t("payment.emptyListTitle"),
        message: t("payment.emptyListMessage"),
        reserved: false,
      });
      return;
    }
    if (!canCheckout) {
      if (!selectedAddress) {
        setCheckoutError({
          title: t("payment.addressNeededTitle"),
          message: t("payment.addressNeededMessage"),
          reserved: isResumingOrder,
        });
        return;
      }
      if (!buyerName || !buyerEmail) {
        setCheckoutError({
          title: t("payment.detailsIncompleteTitle"),
          message: t("payment.detailsIncompleteMessage"),
          reserved: isResumingOrder,
        });
        return;
      }
      return;
    }
    try {
      const latest = await checkCartAvailability(paymentItems);
      if (paymentItems.some((item) => !latest[item.key]?.available)) {
        const unavailable = paymentItems.find(
          (item) => !latest[item.key]?.available,
        );
        setCheckoutError({
          title: t("payment.errorUnavailableTitle"),
          message:
            unavailable?.item_type === "bulk"
              ? t("payment.bulkLotUnavailableMessage")
              : availabilityMessage(latest[unavailable?.key]),
          reserved: false,
        });
        return;
      }
    } catch (error) {
      setCheckoutError(friendlyPaymentError(error, isResumingOrder, t));
      return;
    }
    if (window.self !== window.top) {
      setCheckoutError({
        title: t("payment.iframeTitle"),
        message: t("payment.iframeMessage"),
        reserved: isResumingOrder,
      });
      return;
    }
    setLoading(true);
    let checkoutOrder = resumedOrder;
    try {
      const orderNumber = resumedOrder?.order_number || "GH-" + Date.now();
      const order =
        resumedOrder ||
        (await qurbiApi.entities.Order.create({
          order_number: orderNumber,
          items: paymentItems.map((i) =>
            i.item_type === "bulk"
              ? {
                  item_type: "bulk",
                  bulk_listing_id: i.bulk_listing_id || i.id,
                  farmer_id: i.farmer_id || "",
                  farmer_name: i.farmer_name || "",
                  listing_name: i.listing_name,
                  male_count: i.male_count || 0,
                  female_count: i.female_count || 0,
                  total_animals: i.total_animals || 0,
                  breed_breakdown: i.breed_breakdown || [],
                  state: i.state || "",
                  quantity: 1,
                  price_per_head: i.price_per_head,
                  total: i.total,
                }
              : {
                  livestock_id: i.livestock_id || i.id,
                  farmer_id: i.farmer_id || "",
                  farmer_name: i.farmer_name || "",
                  animal: i.animal,
                  breed: i.breed,
                  grade: i.grade,
                  quantity: 1,
                  weight_min: i.weight_min,
                  weight_max: i.weight_max,
                  price_per_head: i.price_per_head,
                  total: i.total,
                },
          ),
          subtotal: paymentSubtotal,
          delivery_fee: deliveryFee,
          total: grandTotal,
          status: "pending",
          fulfillment_method: fulfillmentMethod,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          buyer_id: user.id,
        }));
      checkoutOrder = order;
      const res = await qurbiApi.functions.invoke("createCheckout", {
        orderId: order.id,
        orderNumber,
        items: paymentItems,
        buyerEmail,
        buyerName,
        subtotal: paymentSubtotal,
        deliveryFee,
        total: grandTotal,
        fulfillmentMethod,
        deliveryAddress: selectedAddress || resumedOrder?.delivery_address || {},
        checkoutGroupId: resumedOrder?.checkout_group_id || newCheckoutGroupId,
      });
      if (res.data?.url) {
        if (!isResumingOrder) {
          if (isBuyNowCheckout) clearBuyNow();
          else removeSelected();
        }
        navigateWithTransition(res.data.url, {
          navigateOptions: { replace: true },
        });
      } else {
        setCheckoutError({
          title: t("payment.paymentCouldNotStartTitle"),
          message: t("payment.paymentCouldNotStartMessage"),
          reserved: true,
          orderId: order.id,
        };
        navigateWithTransition(`/orders/${encodeURIComponent(order.id)}?fromTab=to-pay`, {
          navigateOptions: { replace: true, state: { paymentError: paymentFailure } },
        });
      }
    } catch (err) {
      setCheckoutError(friendlyPaymentError(err, isResumingOrder, t));
    } finally {
      setLoading(false);
    }
  };

  const cancelExistingOrder = async () => {
    if (!resumedOrder?.id || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      await Promise.all(
        (resumedOrder.order_ids || [resumedOrder.id]).map((orderId) =>
          qurbiApi.functions.invoke("cancelMyOrder", { orderId }),
        ),
      );
      navigateWithTransition("/orders", { navigateOptions: { replace: true } });
    } catch (error) {
      setCancelError(
        error.data?.error ||
          error.message ||
          t("payment.cancelOrderFailedAlert"),
      );
    } finally {
      setCancelling(false);
    }
  };

  if (!authChecked) return <QurbiPageLoader label={t("payment.checkingSessionLabel")} />;
  if (!isAuthenticated) {
    return <AuthRequiredState title={t("payment.authRequiredTitle")} message={t("payment.authRequiredMessage")} returnTo={window.location.pathname + window.location.search} />;
  }
  if (loadingOrder || loadingProductDetails)
    return <QurbiPageLoader label={t("payment.preparingPaymentLabel")} />;
  if (resumeError || paymentItems.length === 0) {
    const backPath = isResumingOrder ? "/orders" : "/cart";
    return (
      <div className="aisyah-page flex flex-col">
        <AppHeader title={tf("payment.title")} backTo={backPath} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F7EDE2] shadow-sm">
            <CreditCard aria-hidden="true" className="h-9 w-9 text-[#6B594A]" />
          </div>
          <p className="max-w-xs text-lg font-bold text-[#41362D]">
            {resumeError || t("payment.noItemsSelectedForPayment")}
          </p>
          {!resumeError && (
            <p className="max-w-xs text-sm text-[#6B594A]">{tf("payment.emptyHint")}</p>
          )}
          <button
            type="button"
            onClick={() => navigateWithTransition(backPath)}
            className="aisyah-primary-button min-h-12 w-full max-w-xs"
          >
            {isResumingOrder ? t("payment.backToMyOrders") : t("payment.backToCart")}
          </button>
        </div>
      </div>
    );
  }

  const itemTitle = (item) =>
    item.item_type === "bulk" ? item.listing_name : item.title || item.breed;
  const missingReason = !canCheckout
    ? !selectedAddress && !isResumingOrder
      ? t("payment.selectAddressToContinue")
      : t("payment.completeNameEmailToContinue")
    : "";

  return (
    <div className="aisyah-page qurbi-action-bar-space">
      {showPicker && (
        <AddressPickerModal
          addresses={addresses}
          selectedId={selectedAddressId}
          onSelect={setSelectedAddressId}
          onAddNew={() => navigateWithTransition("/address-book?new=1&returnTo=%2Fpayment")}
          onClose={() => setShowPicker(false)}
        />
      )}

      <AppHeader
        title={tf("payment.title")}
        backTo={isResumingOrder ? "/orders" : "/cart"}
        subtitle={
          isResumingOrder
            ? t("payment.continueOrder", {
                orderNumber: resumedOrder.order_number,
              })
            : tf("payment.itemsSummary", {
                count: paymentItems.length,
                amount: formatRM(paymentSubtotal),
              })
        }
      />

      <div className="aisyah-content max-w-2xl">
        {/* Delivery Address + Buyer Info */}
        {!isResumingOrder && (
          <>
            <section
              aria-labelledby="payment-address-title"
              className={`overflow-hidden rounded-2xl border-2 bg-[#F7EDE2] ${PAYMENT_CARD_SHADOW} ${selectedAddress ? "border-[#41362D]/25" : "border-dashed border-[#B45309]"} ${reveal()}`}
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-3">
                <h2 id="payment-address-title" className="flex items-center gap-2 text-base font-bold text-[#41362D]">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                  {tf("payment.deliveryAddress")}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-sm font-bold text-[#41362D] underline underline-offset-4"
                >
                  {selectedAddress ? t("payment.changeButton") : tf("payment.chooseAddress")}
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              {selectedAddress ? (
                <div className="px-4 pb-4 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedAddress.label && (
                      <span className="text-base font-bold capitalize text-[#41362D]">
                        {selectedAddress.label}
                      </span>
                    )}
                    {selectedAddress.isDefault && (
                      <span className="flex items-center gap-1 rounded-full bg-[#E3C19F] px-2 py-0.5 text-[11px] font-bold text-[#41362D]">
                        <Star aria-hidden="true" className="h-3 w-3 fill-[#5A493C]" />
                        {t("payment.defaultBadge")}
                      </span>
                    )}
                  </div>
                  {selectedAddress.name && (
                    <p className="mt-1 text-sm font-semibold text-[#41362D]">
                      {selectedAddress.name}
                      {selectedAddress.phone ? ` · ${selectedAddress.phone}` : ""}
                    </p>
                  )}
                  <p className="mt-0.5 break-words text-sm text-[#6B594A]">
                    {[selectedAddress.street, selectedAddress.city, selectedAddress.state, selectedAddress.postcode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="block w-full px-4 pb-4 pt-1 text-left"
                >
                  <span className="block text-sm font-bold text-[#78350F]">
                    {t("payment.noAddressSelected")}
                  </span>
                  <span className="block text-sm text-[#6B594A]">
                    {t("payment.tapToSelectAddress")}
                  </span>
                </button>
              )}
            </section>

            <section
              aria-labelledby="payment-contact-title"
              className={`rounded-2xl border bg-[#F7EDE2] p-4 ${PAYMENT_CARD_SHADOW} ${!buyerName || !buyerEmail ? "border-[#B45309]/50" : "border-[#41362D]/15"} ${reveal()}`}
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="payment-contact-title" className="text-base font-bold text-[#41362D]">
                  {t("payment.buyerInformationHeading")}
                </h2>
                <Link
                  to="/address-book"
                  className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-sm font-bold text-[#41362D] underline underline-offset-4"
                >
                  {t("payment.editLink")} <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              {!selectedAddress ? (
                <p className="text-sm text-[#6B594A]">
                  {t("payment.selectAddressAutoFill")}
                </p>
              ) : !buyerName || !buyerEmail ? (
                <div className="rounded-xl border border-[#B45309]/40 bg-[#FEF3C7] p-3" role="alert">
                  <p className="text-sm font-bold text-[#78350F]">
                    {t("payment.incompleteContactInfo")}
                  </p>
                  <p className="mt-0.5 text-sm text-[#78350F]">
                    {t("payment.addNameEmailToAddress")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {[
                    { icon: User, value: buyerName },
                    { icon: Mail, value: buyerEmail },
                    { icon: Phone, value: buyerPhone },
                  ]
                    .filter((row) => row.value)
                    .map(({ icon: Icon, value }) => (
                      <li key={value} className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                          <Icon aria-hidden="true" className="h-4 w-4 text-white" />
                        </span>
                        <span className="min-w-0 break-words text-sm text-[#41362D] [overflow-wrap:anywhere]">{value}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Order items (read-only) */}
        <section
          aria-labelledby="payment-items-title"
          className={`rounded-2xl border border-[#41362D]/15 bg-[#F7EDE2] p-4 ${PAYMENT_CARD_SHADOW} ${reveal()}`}
          style={{ animationDelay: "140ms" }}
        >
          <h2 id="payment-items-title" className="mb-2 text-base font-bold text-[#41362D]">
            {tf("payment.orderItemsCount", { count: paymentItems.length })}
          </h2>
          <ul className="divide-y divide-[#41362D]/10">
            {paymentItems.map((item) => (
              <li
                key={item.key}
                className="flex min-w-0 items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PaymentItemImage
                    item={item}
                    product={productDetails[item.livestock_id]}
                  />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold leading-snug text-[#41362D]">
                      {itemTitle(item)}
                    </p>
                    <p className="break-words text-sm text-[#6B594A]">
                      {item.farmer_name || t("payment.unknownFarmer")}
                      {" · "}
                      {item.item_type === "bulk" ? t("payment.oneLot") : tf("payment.headCount", { count: item.quantity || 1 })}
                      {item.grade ? ` · ${tf("card.grade", { grade: item.grade })}` : ""}
                    </p>
                  </div>
                </div>
                <span className="flex-none text-sm font-bold text-[#41362D]">
                  {formatRM(item.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Payment summary */}
        <section
          aria-labelledby="payment-summary-title"
          className={`rounded-2xl border-2 border-[#41362D]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] p-4 shadow-xl shadow-black/15 ${reveal()}`}
          style={{ animationDelay: "180ms" }}
        >
          <h2 id="payment-summary-title" className="text-base font-bold text-black">{t("payment.paymentSummaryHeading")}</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-black/75">{t("payment.subtotalLabel")}</dt>
              <dd className="font-semibold text-black">{formatRM(paymentSubtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="min-w-0 text-black/75">
                {tf("payment.deliveryFee", {
                  count: farmerCount,
                  fee: formatRM(DUMMY_DELIVERY_FEE_PER_FARMER),
                })}
              </dt>
              <dd className="flex-none font-semibold text-black">{formatRM(deliveryFee)}</dd>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-[#41362D]/20 pt-3">
              <dt className="text-base font-bold text-black">{tf("payment.total")}</dt>
              <dd className="text-2xl font-extrabold text-black">{formatRM(grandTotal)}</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-black/75">
            <Lock aria-hidden="true" className="h-4 w-4" />
            {t("payment.secureCheckoutLabel")}
          </p>
          {missingReason && (
            <p className="mt-2 rounded-xl bg-[#FEF3C7] px-3 py-2 text-sm font-semibold text-[#78350F]" role="status">
              {missingReason}
            </p>
          )}
          {isResumingOrder &&
            ["pending", "pending_payment", "to_pay"].includes(resumedOrder?.status) && (
              <button
                type="button"
                onClick={() => {
                  setCancelError("");
                  setCancelCandidate(resumedOrder);
                }}
                disabled={loading}
                className="mt-4 min-h-12 w-full rounded-xl border-2 border-[#7F1D1D]/50 bg-transparent text-sm font-bold text-[#7F1D1D] disabled:opacity-50"
              >
                {t("payment.cancelPaymentButton")}
              </button>
            )}
        </section>
      </div>

      {/* One primary action, always reachable */}
      <StickyActionBar tone="dark" label={tf("payment.payBarLabel")}>
        <div className="min-w-0 flex-none">
          <p className="text-sm text-white/80">{tf("payment.total")}</p>
          <p className="whitespace-nowrap text-xl font-extrabold leading-tight text-white">{formatRM(grandTotal)}</p>
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading || !canCheckout}
          aria-busy={loading || undefined}
          className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] px-4 text-base font-bold text-[#41362D] transition-all duration-200 ease-out active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <>
              <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-[#41362D] border-t-transparent" />
              {t("payment.processingLabel")}
            </>
          ) : (
            <>
              <CreditCard aria-hidden="true" className="h-5 w-5 flex-none" />
              <span className="truncate">{tf("payment.payAmount", { amount: formatRM(grandTotal) })}</span>
            </>
          )}
        </button>
      </StickyActionBar>

      <CancelOrderModal
        order={cancelCandidate}
        loading={cancelling}
        error={cancelError}
        onConfirm={cancelExistingOrder}
        onClose={() => {
          setCancelError("");
          setCancelCandidate(null);
        }}
      />
      <PaymentErrorModal
        error={checkoutError}
        onClose={() => setCheckoutError(null)}
        onViewOrders={() => {
          setCheckoutError(null);
          navigateWithTransition(
            checkoutError?.orderId
              ? `/orders/${encodeURIComponent(checkoutError.orderId)}?fromTab=to-pay`
              : "/orders?tab=to-pay",
          );
        }}
      />
    </div>
  );
}
