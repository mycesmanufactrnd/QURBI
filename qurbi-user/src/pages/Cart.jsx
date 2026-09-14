import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ShoppingCart, Check, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { GRADE_COLORS } from "@/lib/livestock-data";
import { useReveal } from "@/hooks/useReveal";
import { checkCartAvailability } from "@/lib/livestock-availability";
import AppHeader from "@/components/AppHeader";
import { QurbiCardSkeleton } from "@/components/QurbiLoading";

const ANIMAL_EMOJIS = {
  Cow: "🐄",
  Lamb: "🐑",
  Goat: "🐐",
  Buffalo: "🐃",
  Camel: "🐪",
};

export default function Cart() {
  const {
    cartItems,
    removeFromCart,
    updateQty,
    totalItems,
    selectedKeys,
    toggleSelect,
    selectAll,
    clearSelection,
    removeSelected,
    selectedItems,
    selectedSubtotal,
  } = useCart();
  const navigate = useNavigate();
  const { reveal } = useReveal();
  const [availability, setAvailability] = useState({});
  const [checkingStock, setCheckingStock] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const refreshAvailability = useCallback(async () => {
    setCheckingStock(true);
    setAvailabilityError("");
    try {
      setAvailability(await checkCartAvailability(cartItems));
    } catch {
      setAvailabilityError(
        "We couldn't verify current stock. Your cart has not been changed.",
      );
    } finally {
      setCheckingStock(false);
    }
  }, [cartItems]);
  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);
  const unavailableKeys = useMemo(
    () =>
      new Set(
        cartItems
          .filter((item) => availability[item.key]?.available === false)
          .map((item) => item.key),
      ),
    [cartItems, availability],
  );
  const selectedUnavailable = selectedItems.some((item) =>
    unavailableKeys.has(item.key),
  );
  const hasAvailability = Object.keys(availability).length > 0;

  if (cartItems.length === 0) {
    return (
      <div className="qurbi-page flex flex-col">
        <AppHeader title="Your Cart" subtitle="0 items" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-400 text-center">Your cart is empty.</p>
          <button
            onClick={() => navigate("/browse")}
            className="qurbi-primary-button"
          >
            Browse livestock
          </button>
        </div>
      </div>
    );
  }

  const allSelected =
    selectedKeys.length === cartItems.length && cartItems.length > 0;

  return (
    <div className="qurbi-page overflow-x-hidden pb-52 sm:pb-44">
      <AppHeader
        title="Your Cart"
        subtitle={`${totalItems} head · ${selectedItems.length} selected`}
      />

      <div className="qurbi-content">
        {/* Selection Toolbar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-50 bg-white p-3 shadow-sm ${reveal()}`}
          style={{ animationDelay: "80ms" }}
        >
          <button
            onClick={allSelected ? clearSelection : selectAll}
            className="flex items-center gap-2 active:scale-95 transition-transform"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${allSelected ? "border-[#16A34A] bg-gradient-to-br from-[#16A34A] to-[#22C55E]" : "border-gray-200"}`}
            >
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              Select All
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {selectedKeys.length}/{cartItems.length} selected
            </span>
            {selectedKeys.length > 0 && (
              <button
                onClick={removeSelected}
                className="flex min-h-9 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#B91C1C] px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-red-950/25 transition-transform active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5 text-white" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        {checkingStock && !hasAvailability ? (
          <QurbiCardSkeleton
            count={Math.min(Math.max(cartItems.length, 1), 5)}
            variant="list"
          />
        ) : availabilityError && !hasAvailability ? (
          <div className="rounded-2xl border border-red-200 bg-white/60 p-5 text-center shadow-sm">
            <p className="text-sm text-red-700">{availabilityError}</p>
            <button
              type="button"
              onClick={refreshAvailability}
              className="mt-3 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-5 py-2.5 text-sm font-bold text-white"
            >
              Retry stock check
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-content-ready">
            {cartItems.map((item, idx) => {
              const unavailable = availability[item.key]?.available === false;
              const detailId =
                item.item_type === "bulk"
                  ? item.bulk_listing_id || item.id
                  : item.livestock_id || item.id;
              const detailPath = detailId
                ? item.item_type === "bulk"
                  ? `/bulk-buy/${encodeURIComponent(detailId)}?from=cart`
                  : `/livestock/${encodeURIComponent(detailId)}?from=cart`
                : "";
              const openDetail = () => {
                if (detailPath) navigate(detailPath);
              };
              return (
                <div
                  key={item.key}
                  role={detailPath ? "link" : undefined}
                  tabIndex={detailPath ? 0 : undefined}
                  aria-label={
                    detailPath
                      ? `Open ${item.item_type === "bulk" ? item.listing_name : item.breed} details`
                      : undefined
                  }
                  onClick={(event) => {
                    if (event.target.closest("button, a, input")) return;
                    openDetail();
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetail();
                    }
                  }}
                  className={`min-w-0 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${detailPath ? "cursor-pointer" : ""} ${unavailable ? "border-orange-200 bg-orange-50/30" : selectedKeys.includes(item.key) ? "qurbi-cart-item-selected" : "border-gray-50"} ${reveal()}`}
                  style={{ animationDelay: `${120 + idx * 60}ms` }}
                >
              <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => !unavailable && toggleSelect(item.key)}
                    disabled={unavailable}
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all active:scale-90 ${selectedKeys.includes(item.key) ? "border-[#16A34A] bg-gradient-to-br from-[#16A34A] to-[#22C55E]" : "border-gray-200 bg-white"}`}
                  >
                    {selectedKeys.includes(item.key) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <span className="text-2xl">
                    {item.item_type === "bulk"
                      ? "🐄"
                      : ANIMAL_EMOJIS[item.animal]}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] font-bold text-gray-900">
                      {item.item_type === "bulk"
                        ? item.listing_name
                        : item.breed}
                    </p>
                    <p className="break-words text-xs text-gray-400">
                      {item.item_type === "bulk"
                        ? `${item.total_animals} animals · Bulk lot`
                        : item.animal}
                      {item.farmer_name ? ` · ${item.farmer_name}` : ""}
                    </p>
                    {unavailable && (
                      <p className="text-orange-600 text-xs font-bold mt-1">
                        Unavailable / Out of Stock
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  {item.grade && (
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold ${GRADE_COLORS[item.grade]}`}
                    >
                      {item.grade}
                    </span>
                  )}
                  <button
                    onClick={() => removeFromCart(item.key)}
                    aria-label={`Delete ${item.item_type === "bulk" ? item.listing_name : item.breed} from cart`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DC2626]/60 bg-white/90 text-[#DC2626] shadow-sm transition-transform active:scale-90"
                  >
                    <Trash2 className="h-4 w-4 text-[#DC2626]" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  {item.item_type === "bulk" ? (
                    <p className="text-gray-400 text-xs">
                      {item.male_count || 0} male · {item.female_count || 0}{" "}
                      female · {item.state || "Location not specified"}
                    </p>
                  ) : (
                    item.weight_min > 0 && (
                      <p className="text-gray-400 text-xs">
                        ⚖️{" "}
                        {item.weight_min === item.weight_max
                          ? item.weight_min
                          : `${item.weight_min}–${item.weight_max}`}{" "}
                        kg
                      </p>
                    )
                  )}
                  <p className="text-gray-900 font-bold">
                    RM {item.price_per_head.toLocaleString()}
                    {item.item_type === "bulk" ? " / lot" : "/head"}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between">
                <span className="text-gray-400 text-xs">
                  Subtotal (
                  {item.item_type === "bulk"
                    ? "1 lot"
                    : `${item.quantity} head`}
                  )
                </span>
                <span className="text-gray-900 font-bold text-sm">
                  RM {item.total.toLocaleString()}
                </span>
              </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Payment Button */}
      <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 animate-fade-in-up px-3 sm:px-4">
        <div className="mx-auto w-full max-w-2xl rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] p-3 shadow-xl shadow-black/20 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-white/70">
              {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <span className="text-lg font-bold text-white sm:text-xl">
              RM {selectedSubtotal.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => navigate("/payment")}
            disabled={
              selectedItems.length === 0 ||
              checkingStock ||
              Boolean(availabilityError) ||
              selectedUnavailable
            }
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] px-4 py-2.5 text-sm font-bold text-black transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 sm:rounded-2xl sm:py-3 sm:text-base"
          >
            {checkingStock ? "Checking stock..." : "Payment"}{" "}
            <ChevronRight className="w-5 h-5" />
          </button>
          {selectedItems.length === 0 && (
            <p className="mt-2 text-center text-xs text-white/70">
              Select at least one item to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
