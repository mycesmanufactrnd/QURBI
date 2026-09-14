import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShoppingCart } from "lucide-react";

/** Shared cart summary shown at the top of marketplace content. */
export default function ViewCartCard({ totalItems, totalPrice }) {
  if (totalItems <= 0) return null;

  return (
    <Link
      to="/cart"
      viewTransition
      className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-[#41362D]/25 bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 py-3 text-left text-white shadow-lg shadow-black/15 transition-all duration-300 ease-out hover:scale-[1.005] active:translate-y-0.5 active:scale-[0.995] sm:mx-auto sm:max-w-3xl"
      aria-label={`View cart with ${totalItems} item${totalItems === 1 ? "" : "s"}`}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/15">
        <ShoppingCart className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-white">
          {totalItems} item{totalItems > 1 ? "s" : ""} in cart
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-white/65">
          RM {totalPrice.toLocaleString()}
        </span>
      </span>

      <span className="flex flex-none items-center gap-1 text-xs font-bold text-white">
        View Cart <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
