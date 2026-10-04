import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, Boxes, Home, Leaf, Package, ShoppingCart, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import AuthButtons from "@/components/AuthButtons";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart-context";
import { useNotifications } from "@/lib/notification-context";

const ITEMS = [
  { to: "/", icon: Home, labelKey: "bottomNav.home", end: true },
  { to: "/browse", icon: Leaf, labelKey: "bottomNav.browse" },
  { to: "/bulk-buy", icon: Boxes, labelKey: "bottomNav.bulkBuy" },
  { to: "/cart", icon: ShoppingCart, labelKey: "bottomNav.cart", badge: "cart" },
  { to: "/orders", icon: Package, labelKey: "bottomNav.orders" },
  { to: "/notifications", icon: Bell, labelKey: "sidebar.notifications", badge: "notifications" },
  { to: "/profile", icon: User, labelKey: "sidebar.profile" },
];

/**
 * Desktop navigation (shown from the `lg` breakpoint up). On smaller screens
 * the BottomNav is used instead, so the two never appear together.
 */
export default function Sidebar() {
  const { t } = useTranslation("common");
  const { t: tf } = useTranslation("shopflow");
  const { user, isAuthenticated } = useAuth();
  const { totalItems = 0 } = useCart() || {};
  const { unreadCount = 0 } = useNotifications() || {};
  const counts = { cart: totalItems, notifications: unreadCount };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-white/10 bg-gradient-to-b from-[#41362D] to-[#6B594A] shadow-[4px_0_24px_rgba(65,54,45,0.3)] lg:flex">
      <Link to="/" className="flex items-center gap-2 border-b border-white/15 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
          <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-bold tracking-[0.16em] text-white">QURBI</span>
      </Link>

      <nav aria-label={tf("nav.label")} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ITEMS.map(({ to, icon: Icon, labelKey, end, badge }) => {
          const count = badge ? counts[badge] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9825F] ${
                  isActive
                    ? "bg-[#E3C19F] text-[#41362D] shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                    : "text-white hover:bg-white/10"
                }`
              }
            >
              <Icon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7EDE2] px-1.5 text-[11px] font-bold text-[#41362D] ring-1 ring-[#41362D]/30">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/15 px-3 py-4">
        {isAuthenticated && (
          <div className="px-3">
            <p className="truncate text-xs font-bold text-white">{user?.display_name || user?.email}</p>
            <p className="truncate text-xs text-white/75">{user?.email}</p>
          </div>
        )}
        <AuthButtons onDark />
      </div>
    </aside>
  );
}
