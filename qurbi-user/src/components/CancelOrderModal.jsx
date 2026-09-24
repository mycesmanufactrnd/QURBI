import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

export default function CancelOrderModal({ order, loading, error, onConfirm, onClose }) {
  const firstItem = order?.items?.[0];
  const orderDisplayName = firstItem?.breed || firstItem?.listing_name || firstItem?.animal || order?.order_number || "Order";
  useEffect(() => {
    if (!order) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, order]);

  if (!order) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-title"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#F7EDE2]/40 bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F7EDE2]/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-[#F7EDE2]/50 bg-white/10">
              <AlertTriangle className="h-5 w-5 text-[#F7EDE2]" />
            </div>
            <div className="min-w-0">
              <h2 id="cancel-order-title" className="text-lg font-bold text-white">
                Cancel unpaid order?
              </h2>
              <p className="mt-0.5 break-words text-xs text-[#F7EDE2]/80">
                {orderDisplayName} · RM {Number(order.total || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close cancel order dialog"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-[#F7EDE2]/60 text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="rounded-2xl border border-[#41362D]/30 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] p-4 text-sm leading-relaxed text-[#41362D]">
            This unpaid order will be cancelled and cannot be restored.
          </p>
          {error && (
            <p className="mt-3 rounded-xl border border-red-300/60 bg-red-950/25 p-3 text-center text-xs font-medium text-white">
              {error}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-12 rounded-xl border border-[#F7EDE2] text-sm font-bold text-white disabled:opacity-50"
            >
              Keep Order
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="min-h-12 rounded-xl border-2 border-[#41362D] bg-gradient-to-br from-[#EF4444] to-[#B91C1C] text-sm font-bold text-white shadow-sm shadow-red-950/25 disabled:opacity-50"
            >
              {loading ? "Cancelling..." : "Cancel Order"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
