import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MapPin,
  ChevronRight,
  User,
  Phone,
  Mail,
  Star,
  CreditCard,
  ArrowLeft,
  Package,
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

const DELIVERY_FEE_PER_FARMER = 10;
const PAYMENT_CARD_SHADOW = "shadow-[0_12px_28px_rgba(65,54,45,0.18)]";

function friendlyPaymentError(error, reservationAlreadyExists = false) {
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
      title: "Payment was not completed",
      message:
        "The payment provider could not complete this payment. Please check your balance or payment method before trying again.",
      reserved: reservationAlreadyExists,
    };
  }
  if (status === 409 || /reserved|no longer available/.test(rawMessage)) {
    return {
      title: "This item is unavailable",
      message:
        "Another buyer may have reserved this livestock. Please return to your cart and choose an available item.",
      reserved: reservationAlreadyExists,
    };
  }
  if (status === 401) {
    return {
      title: "Please sign in again",
      message:
        "Your session has ended. Sign in again, then return to your order to continue payment.",
      reserved: reservationAlreadyExists,
    };
  }
  if (!error?.response || /network|failed to fetch|qurbi server/.test(rawMessage)) {
    return {
      title: "We could not reach QURBI",
      message:
        "Please check that the QURBI server and your internet connection are available, then try again.",
      reserved: reservationAlreadyExists,
    };
  }
  return {
    title: "We could not continue payment",
    message:
      "Something went wrong while preparing your payment. No extra charge was made. Please try again.",
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
  return (
    item.farm_location ||
    item.farmLocation ||
    item.farm_address ||
    product?.farm_location ||
    product?.farmLocation ||
    product?.farm_address ||
    item.state ||
    product?.state ||
    "Location unavailable"
  );
}

export default function Payment() {
  const { requestSignIn } = useAuthPrompt();
  const { selectedItems, selectedSubtotal, removeSelected } = useCart();
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
  const resumeOrderId = searchParams.get("order_id");
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
  const fulfillmentMethod = "delivery";

  useEffect(() => {
    if (!resumeOrderId) return;
    if (!authChecked) {
      setLoadingOrder(true);
      return;
    }
    let active = true;
    (async () => {
      if (!isAuthenticated || !user?.id) {
        setResumeError("Sign in to load this unpaid order.");
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
            throw new Error("Payment reservation expired.");
          }
          throw new Error("This order is no longer awaiting payment.");
        }
        if (active) {
          setResumedOrder(order);
          setLoadingProductDetails(Boolean(order.items?.length));
        }
      } catch (error) {
        if (active)
          setResumeError(
            error.message || "We couldn't load this unpaid order.",
          );
      } finally {
        if (active) setLoadingOrder(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authChecked, isAuthenticated, resumeOrderId, user?.id]);

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
  }, [resumedOrder?.id]);

  const isResumingOrder = Boolean(resumeOrderId);
  const paymentItems = resumedOrder
    ? (resumedOrder.items || []).map((item, index) => ({
        ...item,
        key: item.livestock_id || `${resumedOrder.id}-${index}`,
        quantity: 1,
        total: item.total ?? item.price_per_head,
      }))
    : selectedItems;
  const paymentSubtotal = resumedOrder?.subtotal ?? selectedSubtotal;

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

  const confirmReservedOrderExists = async () => {
    if (isResumingOrder && resumedOrder?.id) return true;

    const requestedProducts = new Set(
      paymentItems.map((item) =>
        item.item_type === "bulk"
          ? `bulk:${item.bulk_listing_id || item.id}`
          : `livestock:${item.livestock_id || item.id}`,
      ),
    );

    try {
      const response = await qurbiApi.functions.invoke("fetchMyOrders", {});
      return (response.data?.orders || []).some((order) => {
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
      return false;
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated || !user?.id) {
      requestSignIn({ returnTo: "/payment", message: "Sign in to securely continue with checkout." });
      return;
    }
    setCheckoutError(null);
    if (paymentItems.length === 0) {
      setCheckoutError({
        title: "Your payment list is empty",
        message: "Select an item from your cart before continuing to payment.",
        reserved: false,
      });
      return;
    }
    if (!canCheckout) {
      if (!selectedAddress) {
        setCheckoutError({
          title: "Delivery address needed",
          message: "Choose or add a delivery address before continuing.",
          reserved: isResumingOrder,
        });
        return;
      }
      if (!buyerName || !buyerEmail) {
        setCheckoutError({
          title: "Delivery details incomplete",
          message: "Add your name and email in your profile before continuing.",
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
          title: "This item is unavailable",
          message:
            unavailable?.item_type === "bulk"
              ? "This bulk lot is no longer available. Please choose another listing."
              : availabilityMessage(latest[unavailable?.key]),
          reserved: false,
        });
        return;
      }
    } catch (error) {
      setCheckoutError(friendlyPaymentError(error, isResumingOrder));
      return;
    }
    setLoading(true);
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
      });
      if (res.data?.url) {
        if (!isResumingOrder) removeSelected();
        navigateWithTransition(res.data.url, {
          navigateOptions: { replace: true },
        });
      } else {
        setCheckoutError({
          title: "Payment could not start",
          message:
            "Your order was saved, but the payment page could not be opened. Continue from My Orders.",
          reserved: true,
        });
      }
    } catch (err) {
      const reservationWasSaved = await confirmReservedOrderExists();
      setCheckoutError(friendlyPaymentError(err, reservationWasSaved));
    } finally {
      setLoading(false);
    }
  };

  const cancelExistingOrder = async () => {
    if (!resumedOrder?.id || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      await qurbiApi.functions.invoke("cancelMyOrder", {
        orderId: resumedOrder.id,
      });
      navigateWithTransition("/orders", { navigateOptions: { replace: true } });
    } catch (error) {
      setCancelError(
        error.data?.error ||
          error.message ||
          "We couldn't cancel this order. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  };

  if (!authChecked) return <QurbiPageLoader label="Checking your session…" />;
  if (!isAuthenticated) {
    return <AuthRequiredState title="Payment" message="Sign in to securely continue with payment." returnTo={window.location.pathname + window.location.search} />;
  }
  if (loadingOrder || loadingProductDetails)
    return <QurbiPageLoader label="Preparing payment…" />;
  if (resumeError)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#E3C19F] p-8">
        <p className="text-gray-500 text-center">{resumeError}</p>
        <button
          onClick={() => navigateWithTransition("/orders")}
          className="rounded-xl px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80"
        >
          Back to My Orders
        </button>
      </div>
    );
  if (paymentItems.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#E3C19F] p-8">
        <p className="text-gray-500">No items selected for payment.</p>
        <button
          onClick={() => navigateWithTransition(isResumingOrder ? "/orders" : "/cart")}
          className="rounded-xl px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80"
        >
          {isResumingOrder ? "Back to My Orders" : "Back to Cart"}
        </button>
      </div>
    );
  }

  return (
    <div className="aisyah-page pb-28">
      {showPicker && (
        <AddressPickerModal
          addresses={addresses}
          selectedId={selectedAddressId}
          onSelect={setSelectedAddressId}
          onAddNew={() => navigateWithTransition("/address-book?new=1&returnTo=%2Fpayment")}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="flex items-center gap-3 px-4 pt-5">
        <button
          type="button"
          onClick={() => navigateWithTransition(isResumingOrder ? "/orders" : "/cart")}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-md shadow-black/20 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[15px] font-bold uppercase tracking-[0.35em] text-[#6B594A]">
            QURBI
          </p>
          <p className="text-sm font-bold text-[#41362D]">
            {isResumingOrder
              ? `Continue ${resumedOrder.order_number}`
              : `${paymentItems.length} item${paymentItems.length !== 1 ? "s" : ""} · RM ${paymentSubtotal.toLocaleString()}`}
          </p>
        </div>
      </div>

      <div className="aisyah-content">
        {/* Selected Items (read-only) */}
        <div
          className={`bg-white rounded-2xl p-4 border border-gray-50 ${reveal()}`}
          style={{ animationDelay: "80ms" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-[#F7EDE2] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white">Order Items</h3>
              <p className="text-xs font-medium text-white/65">
                Tap a product to view its details
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {paymentItems.map((item) => {
              const productId =
                item.item_type === "bulk"
                  ? item.bulk_listing_id || item.id
                  : item.livestock_id || item.id;
              const returnTo = resumeOrderId
                ? `/payment?order_id=${encodeURIComponent(resumeOrderId)}`
                : "/payment";
              const productPath = productId
                ? `${item.item_type === "bulk" ? "/bulk-buy" : "/livestock"}/${encodeURIComponent(productId)}?from=payment&returnTo=${encodeURIComponent(returnTo)}`
                : "";
              const ItemContainer = productPath ? "button" : "div";
              const product = productDetails[
                item.item_type === "bulk" ? item.bulk_listing_id : item.livestock_id
              ];
              const productLabel =
                (item.item_type === "bulk"
                  ? item.listing_name
                  : item.breed) || "Product details";
              const farmerLocation = paymentItemLocation(item, product);

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
                      ? `View ${item.item_type === "bulk" ? item.listing_name : item.breed} product details`
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
                        {item.item_type === "bulk"
                          ? item.listing_name
                          : item.breed}
                      </p>
                      <p className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-white/65">
                        <MapPin className="h-3 w-3 flex-none text-[#E3C19F]" />
                        <span className="truncate">{farmerLocation}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <div className="text-right">
                      <p className="whitespace-nowrap text-sm font-extrabold text-white">
                        RM {item.total.toLocaleString()}
                      </p>
                      {productPath && (
                        <p className="text-[10px] font-semibold text-white/60">
                          View details
                        </p>
                      )}
                    </div>
                    {productPath && (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#F7EDE2] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-md shadow-black/20">
                        <ChevronRight className="h-5 w-5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </ItemContainer>
              );
            })}
          </div>
        </div>
            <br></br>
        {/* Delivery Address + Buyer Info */}
        {!isResumingOrder && (
          <>
            <button
              onClick={() => setShowPicker(true)}
              className={`w-full bg-white rounded-2xl ${PAYMENT_CARD_SHADOW} border-2 overflow-hidden transition-all text-left active:scale-[0.99] ${selectedAddress ? "border-[#D5B18D]" : "border-dashed border-orange-200"}`}
            >
              <div
                className={`px-4 py-2 flex items-center justify-between ${selectedAddress ? "bg-[#F7EDE2]" : "bg-orange-50"}`}
              >
                <span
                  className={`text-xs font-bold ${selectedAddress ? "text-[#41362D]" : "text-orange-500"}`}
                >
                  DELIVERY ADDRESS
                </span>
                <span className="text-xs text-black font-semibold flex items-center gap-0.5">
                  Change <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <div className="px-4 py-3 flex items-start gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-black/15"
                >
                  <MapPin
                    className="h-5 w-5 text-white"
                  />
                </div>
                {selectedAddress ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAddress.label && (
                        <span className="text-gray-900 font-bold text-sm">
                          {selectedAddress.label}
                        </span>
                      )}
                      {selectedAddress.isDefault && (
                        <span className="bg-[#E3C19F] text-[#41362D] text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-[#5A493C]" />{" "}
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {selectedAddress.name && (
                      <p className="text-gray-700 text-sm font-medium mt-0.5">
                        {selectedAddress.name}
                      </p>
                    )}
                    {selectedAddress.phone && (
                      <p className="text-gray-400 text-xs">
                        {selectedAddress.phone}
                      </p>
                    )}
                    <p className="text-gray-500 text-xs mt-0.5 truncate">
                      {selectedAddress.street}, {selectedAddress.city}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-orange-500 font-semibold text-sm">
                      No address selected
                    </p>
                    <p className="text-gray-400 text-xs">
                      Tap to select a delivery address
                    </p>
                  </div>
                )}
              </div>
            </button>

            <div
              className={`bg-white rounded-2xl p-4 ${PAYMENT_CARD_SHADOW} border ${!buyerName || !buyerEmail ? "border-orange-100" : "border-gray-50"} space-y-2`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-gray-800 font-bold text-sm">
                  Buyer Information
                </h3>
                <Link
                  to="/address-book"
                  className="flex items-center gap-0.5 text-xs font-semibold text-white"
                >
                  Edit <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {!selectedAddress ? (
                <p className="text-gray-400 text-xs italic">
                  Select a delivery address above to auto-fill.
                </p>
              ) : !buyerName || !buyerEmail ? (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-orange-600 text-sm font-semibold">
                    ⚠️ Incomplete contact info
                  </p>
                  <p className="text-orange-400 text-xs mt-0.5">
                    Add name & email to this address to proceed.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                      <User className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-gray-800 text-sm">{buyerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                      <Mail className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-gray-600 text-sm">{buyerEmail}</span>
                  </div>
                  {buyerPhone && (
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                        <Phone className="h-3.5 w-3.5 text-white" />
                      </span>
                      <span className="text-gray-600 text-sm">
                        {buyerPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Payment box stays at the end of the document and is reached by scrolling. */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto max-w-md rounded-2xl border-2 border-[#41362D]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] p-4 shadow-xl shadow-black/15">
          <div className="space-y-2">
            <h3 className="font-bold text-black">Payment Summary</h3>
            {paymentItems.map((item) => (
              <div
                key={item.key}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="min-w-0 text-black/70">
                  {item.item_type === "bulk"
                    ? item.listing_name
                    : `${item.breed}${item.grade ? ` (${item.grade})` : ""}`}{" "}
                  × {item.item_type === "bulk" ? "1 lot" : item.quantity}
                </span>
                <span className="flex-none font-semibold text-black">
                  RM {item.total.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-[#E3C19F] pt-2 text-sm">
              <span className="text-black/70">Subtotal</span>
              <span className="font-semibold text-black">
                RM {paymentSubtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-black/70">
                Delivery Fee ({farmerCount} farmer
                {farmerCount !== 1 ? "s" : ""} × RM{" "}
                {DELIVERY_FEE_PER_FARMER})
              </span>
              <span className="flex-none font-semibold text-black">
                RM {deliveryFee.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="my-3 flex items-center justify-between border-t border-[#E3C19F] pt-3">
            <div>
              <p className="text-xs font-semibold text-black/70">
                Delivery total
              </p>
              <p className="text-xl font-extrabold text-black">
                RM {grandTotal.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-black/70">Secure checkout</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading || !canCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] py-4 text-lg font-bold text-white shadow-md shadow-black/20 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                Processing...
              </span>
            ) : (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                  <CreditCard className="h-5 w-5 text-white" />
                </span>
                Pay RM{" "}
                {grandTotal.toLocaleString()}
              </>
            )}
          </button>
          {isResumingOrder &&
            ["pending", "pending_payment", "to_pay"].includes(resumedOrder?.status) && (
              <button
                onClick={() => {
                  setCancelError("");
                  setCancelCandidate(resumedOrder);
                }}
                disabled={loading}
                className="mt-2 w-full rounded-xl border-2 border-[#41362D] bg-gradient-to-br from-[#EF4444] to-[#B91C1C] py-3 text-sm font-bold text-white shadow-sm shadow-red-950/25 disabled:opacity-50"
              >
                Cancel Payment
              </button>
            )}
          {!canCheckout && (
            <p className="mt-2 text-center text-xs text-black/70">
              {!selectedAddress
                ? "Select a delivery address to continue"
                : "Complete your name and email to continue"}
            </p>
          )}
        </div>
      </div>
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
          navigateWithTransition("/orders");
        }}
      />
    </div>
  );
}
