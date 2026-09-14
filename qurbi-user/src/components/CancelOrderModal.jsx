import React from "react";

export default function CancelOrderModal({ order, loading, error, onConfirm, onClose }) {
  if (!order) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-5 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => !loading && onClose()}>
    <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-200" />
      <h2 className="text-lg font-bold text-gray-900">Cancel unpaid order?</h2>
      <p className="mt-2 text-sm text-gray-500">{order.order_number} · RM {order.total?.toLocaleString()}</p>
      <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">This unpaid order will be cancelled and cannot be restored.</p>
      {error && <p className="mt-3 text-center text-xs font-medium text-red-500">{error}</p>}
      <button onClick={onConfirm} disabled={loading} className="mt-5 w-full rounded-xl border-2 border-[#41362D] bg-gradient-to-br from-[#EF4444] to-[#B91C1C] py-3.5 font-bold text-white shadow-sm shadow-red-950/25 disabled:opacity-50">{loading ? "Cancelling..." : "Cancel Order"}</button>
      <button onClick={onClose} disabled={loading} className="mt-2 w-full rounded-xl bg-gray-100 py-3.5 font-bold text-gray-700 disabled:opacity-50">Keep Order</button>
    </div>
  </div>;
}
