import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  ChevronRight,
  User,
  Phone,
  Mail,
  CreditCard,
  Star,
  Lock,
  Package,
  Check,
  Store,
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
import { extractState } from "@/lib/livestock-data";
import { combineOrders, groupItemsByFarm } from "@/lib/order-groups";

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
      reserved: reservationAlreadyExists,
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

function paymentItemImageUrl(item, product) {
  return (
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
    extractState(location) ||
    item.farm_state ||
    item.state ||
    product?.farm_state ||
    product?.state ||
    ""
  );
}

function productForPaymentItem(item, productDetails) {
  const productId = item.item_type === "bulk"
    ? item.bulk_listing_id || item.id
    : item.livestock_id || item.id;
  return productDetails[productId];
}

function deliveryAddressLines(address) {
  if (!address) return [];

  const street = String(address.street || address.addressLine1 || "").trim();
  const streetTwo = String(address.addressLine2 || "").trim();
  const postcode = String(address.postcode || address.postalCode || "").trim();
  const city = String(address.city || "").trim();
  const state = String(address.state || "").trim();
  const country = String(address.country || "").trim();
  const locality = [postcode, city].filter(Boolean).join(" ");

  return [street, streetTwo, locality, state, country].filter(Boolean);
}

function PaymentStepper({ currentStep, onStepChange }) {
  const { t } = useTranslation("cart");
  const steps = [
    t("payment.stepReview"),
    t("payment.stepDelivery"),
    t("payment.stepPayment"),
  ];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5" aria-label={t("payment.stepperAria")}>
      <div className="rounded-2xl border border-[#E3C19F]/70 bg-white/75 px-4 py-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-start">
          {steps.map((label, index) => {
            const step = index + 1;
            const completed = step < currentStep;
            const active = step === currentStep;
            return (
              <React.Fragment key={label}>
                <button
                  type="button"
                  onClick={() => step < currentStep && onStepChange(step)}
                  disabled={step >= currentStep}
                  className="flex min-w-0 flex-1 flex-col items-center text-center disabled:cursor-default"
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold [text-shadow:0_1px_2px_rgba(65,54,45,0.85)] ${
                      completed
                        ? "border-[#15803D] bg-gradient-to-br from-[#22C55E] to-[#15803D] text-white shadow-sm"
                        : active
                          ? "border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-md"
                          : "border-[#6B594A] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-white"
                    }`}
                  >
                    {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
                  </span>
                  <span className={`mt-1 text-[11px] font-bold text-white`}>
                    {label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <span className={`mt-4 h-0.5 flex-1 ${step < currentStep ? "bg-[#16A34A]" : "bg-[#D5B18D]/60"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { reveal } = useReveal();
  const resumeOrderParam = searchParams.get("order_ids") || searchParams.get("order_id") || "";
  const resumeOrderIds = resumeOrderParam.split(",").map((id) => id.trim()).filter(Boolean);
  const resumeOrderId = resumeOrderIds[0] || "";
  const isBuyNowCheckout = searchParams.get("source") === "buy-now";
  const requestedCheckoutStep = Number(searchParams.get("step"));
  const initialCheckoutStep = resumeOrderId
    ? 3
    : [1, 2, 3].includes(requestedCheckoutStep)
      ? requestedCheckoutStep
      : 1;
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
  const [checkoutStep, setCheckoutStep] = useState(initialCheckoutStep);
  const [newCheckoutGroupId] = useState(() =>
    globalThis.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const fulfillmentMethod = "delivery";

  useEffect(() => {
    if (resumeOrderId) {
      setCheckoutStep(3);
      return;
    }
    if ([1, 2, 3].includes(requestedCheckoutStep)) {
      setCheckoutStep(requestedCheckoutStep);
    }
  }, [requestedCheckoutStep, resumeOrderId]);

  const changeCheckoutStep = (step) => {
    setCheckoutStep(step);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("step", String(step));
    setSearchParams(nextParams, { replace: true });
  };

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
        const responses = await Promise.all(
          resumeOrderIds.map((orderId) =>
            qurbiApi.functions.invoke("fetchMyOrders", { orderId }),
          ),
        );
        const orders = responses.map((response) => response.data?.order).filter(Boolean);
        const order = combineOrders(orders);
        if (!order || orders.some((item) => !["pending", "pending_payment", "to_pay"].includes(item.status))) {
          if (orders.some((item) => item?.cancellationReason === "Payment reservation expired")) {
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
  const paymentFarmGroups = groupItemsByFarm(
    paymentItems,
    (item) => productForPaymentItem(item, productDetails),
  );
  const paymentReturnParams = new URLSearchParams(searchParams);
  paymentReturnParams.set("step", String(checkoutStep));
  const currentPaymentReturnTo = `/payment?${paymentReturnParams.toString()}`;
  const deliveryReturnParams = new URLSearchParams(searchParams);
  deliveryReturnParams.set("step", "2");
  const deliveryReturnTo = `/payment?${deliveryReturnParams.toString()}`;

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
        orderIds: resumedOrder?.order_ids || [],
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
        window.location.assign(res.data.url);
      } else {
        const paymentFailure = {
          title: t("payment.paymentCouldNotStartTitle"),
          message: t("payment.paymentCouldNotStartMessage"),
          reserved: true,
          orderId: order.id,
        };
        navigateWithTransition(`/orders/${encodeURIComponent(order.id)}?fromTab=to-pay`, {
          navigateOptions: { replace: true, state: { paymentError: paymentFailure, returnTo: "/orders?tab=to-pay" } },
        });
      }
    } catch (err) {
      const reservedOrder = checkoutOrder?.id ? checkoutOrder : await findReservedOrder();
      const paymentFailure = {
        ...friendlyPaymentError(err, Boolean(reservedOrder), t),
        orderId: reservedOrder?.id || "",
      };
      if (reservedOrder?.id) {
        navigateWithTransition(`/orders/${encodeURIComponent(reservedOrder.id)}?fromTab=to-pay`, {
          navigateOptions: { replace: true, state: { paymentError: paymentFailure, returnTo: "/orders?tab=to-pay" } },
        });
      } else {
        setCheckoutError(paymentFailure);
      }
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
          onAddNew={() =>
            navigateWithTransition(
              `/address-book?new=1&returnTo=${encodeURIComponent(deliveryReturnTo)}`,
            )
          }
          onClose={() => setShowPicker(false)}
        />
      )}

      <AppHeader
        title={tf("payment.title")}
        backTo={isResumingOrder ? "/orders" : "/cart"}
        preferRecentBack={false}
        subtitle={
          isResumingOrder
            ? t("payment.continueOrder")
            : tf("payment.itemsSummary", {
                count: paymentItems.length,
                amount: formatRM(paymentSubtotal),
              })
        }
      />

      <PaymentStepper
        currentStep={checkoutStep}
        onStepChange={changeCheckoutStep}
      />

      <div className="aisyah-content max-w-2xl">
        {/* Step 1: order items (read-only) */}
        {checkoutStep === 1 && (
          <>
            <section
              aria-labelledby="payment-items-title"
              className={`rounded-2xl border border-[#E3C19F]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] p-4 shadow-lg shadow-[#41362D]/20 ${reveal()}`}
              style={{ animationDelay: "80ms" }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-[#F7EDE2] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-sm">
                  <Package aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="payment-items-title" className="font-bold text-white">
                    {tf("payment.orderItemsCount", { count: paymentItems.length })}
                  </h2>
                  <p className="text-xs font-medium text-white/65">
                    {t("payment.tapProductHint")}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {paymentFarmGroups.map((farmGroup) => (
                  <div key={farmGroup.key} className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-white/15 px-1 pb-2">
                      <Store aria-hidden="true" className="h-4 w-4 flex-none text-[#E3C19F]" />
                      <p className="min-w-0 truncate text-sm font-extrabold text-white">
                        {farmGroup.name === "Farm unavailable"
                          ? t("payment.farmUnavailable")
                          : farmGroup.name}
                      </p>
                    </div>
                    <div className="space-y-2">
                    {farmGroup.items.map((item) => {
                      const productId =
                        item.item_type === "bulk"
                          ? item.bulk_listing_id || item.id
                          : item.livestock_id || item.id;
                      const returnTo = currentPaymentReturnTo;
                      const productPath = productId
                        ? `${item.item_type === "bulk" ? "/bulk-buy" : "/livestock"}/${encodeURIComponent(productId)}?from=payment&returnTo=${encodeURIComponent(returnTo)}`
                        : "";
                      const ItemContainer = productPath ? "button" : "div";
                      const product = productForPaymentItem(item, productDetails);
                      const productLabel =
                        (item.item_type === "bulk" ? item.listing_name : item.breed) ||
                        t("payment.productDetailsFallback");
                      const farmerLocation =
                        paymentItemLocation(item, product) || t("payment.stateUnavailable");

                      return (
                        <ItemContainer
                          key={item.key}
                          type={productPath ? "button" : undefined}
                          onClick={
                            productPath
                              ? (event) =>
                                  navigateFromProductCard(
                                    productPath,
                                    event.currentTarget,
                                    {
                                      image: paymentItemImageUrl(item, product),
                                      label: productLabel,
                                    },
                                  )
                              : undefined
                          }
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border border-[#E3C19F]/35 bg-[rgba(255,255,255,0.08)] p-3 text-left shadow-sm transition-all duration-200 ${productPath ? "cursor-pointer hover:border-[#F7EDE2] hover:bg-[rgba(255,255,255,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F] active:scale-[0.99]" : ""}`}
                          aria-label={
                            productPath
                              ? t("payment.viewProductAria", { name: productLabel })
                              : undefined
                          }
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductImage
                              src={paymentItemImageUrl(item, product)}
                              alt={productLabel}
                              className="h-12 w-12 shadow-md shadow-black/15"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {itemTitle(item)}
                              </p>
                              <p className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-white/65">
                                <MapPin aria-hidden="true" className="h-3 w-3 flex-none text-[#E3C19F]" />
                                <span className="truncate">{farmerLocation}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-none items-center gap-2">
                            <div className="text-right">
                              <p className="whitespace-nowrap text-sm font-extrabold text-white">
                                {formatRM(item.total)}
                              </p>
                              {productPath && (
                                <p className="text-[10px] font-semibold text-white/60">
                                  {t("payment.viewDetails")}
                                </p>
                              )}
                            </div>
                            {productPath && (
                              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#F7EDE2] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-md shadow-black/20">
                                <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </ItemContainer>
                      );
                    })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <button
              type="button"
              onClick={() => changeCheckoutStep(2)}
              className="mt-4 min-h-12 w-full rounded-2xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] py-3.5 text-sm font-extrabold text-white shadow-md shadow-black/20"
            >
              {t("payment.continueToDelivery")}
            </button>
          </>
        )}

        {/* Step 2: delivery address + buyer info */}
        {checkoutStep === 2 && !isResumingOrder && (
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
                  <address className="mt-0.5 space-y-0.5 text-sm not-italic text-[#6B594A]">
                    {deliveryAddressLines(selectedAddress).map((line, index) => (
                      <span key={`${line}-${index}`} className="block break-words">
                        {line}
                      </span>
                    ))}
                  </address>
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

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => changeCheckoutStep(1)}
                className="min-h-12 rounded-2xl border-2 border-[#41362D] bg-white py-3 text-sm font-extrabold text-[#41362D]"
              >
                {t("payment.backToReview")}
              </button>
              <button
                type="button"
                onClick={() => changeCheckoutStep(3)}
                disabled={!canCheckout}
                className="min-h-12 rounded-2xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] py-3 text-sm font-extrabold text-white shadow-md shadow-black/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("payment.continueToPayment")}
              </button>
            </div>
          </>
        )}

        {/* Step 3: payment summary */}
        {checkoutStep === 3 && (
          <section
            aria-labelledby="payment-summary-title"
            className={`rounded-2xl border-2 border-[#41362D]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] p-4 shadow-xl shadow-black/15 ${reveal()}`}
            style={{ animationDelay: "180ms" }}
          >
            <h2 id="payment-summary-title" className="text-base font-bold text-black">{t("payment.paymentSummaryHeading")}</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {paymentItems.map((item) => (
                <div key={item.key} className="flex justify-between gap-3">
                  <dt className="min-w-0 break-words text-black/75">
                    {itemTitle(item)}
                    {item.grade ? ` (${item.grade})` : ""}
                    {" × "}
                    {item.item_type === "bulk"
                      ? t("payment.oneLot")
                      : item.quantity || 1}
                  </dt>
                  <dd className="flex-none font-semibold text-black">{formatRM(item.total)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-[#41362D]/20 pt-2">
                <dt className="text-black/75">{t("payment.subtotalLabel")}</dt>
                <dd className="font-semibold text-black">{formatRM(paymentSubtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="min-w-0 text-black/75">
                  {tf("payment.deliveryFee", {
                    count: farmerCount,
                    fee: formatRM(DELIVERY_FEE_PER_FARMER),
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
            {!isResumingOrder && (
              <button
                type="button"
                onClick={() => changeCheckoutStep(2)}
                disabled={loading}
                className="mt-3 min-h-12 w-full rounded-xl border-2 border-[#41362D] bg-white py-3 text-sm font-bold text-[#41362D] disabled:opacity-50"
              >
                {t("payment.backToDelivery")}
              </button>
            )}
          </section>
        )}
      </div>

      {/* One primary action, always reachable on the payment step */}
      {checkoutStep === 3 && (
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
      )}

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
        viewOrderLabel="View Order"
        onClose={() => setCheckoutError(null)}
        onViewOrders={() => {
          setCheckoutError(null);
          navigateWithTransition(
            checkoutError?.orderId
              ? `/orders/${encodeURIComponent(checkoutError.orderId)}?fromTab=to-pay`
              : "/orders?tab=to-pay",
            checkoutError?.orderId
              ? { navigateOptions: { state: { returnTo: "/orders?tab=to-pay" } } }
              : undefined,
          );
        }}
      />
    </div>
  );
}
