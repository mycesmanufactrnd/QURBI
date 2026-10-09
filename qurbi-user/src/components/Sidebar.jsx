import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Boxes, Home, Leaf, Package, ReceiptText, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import AuthButtons from "@/components/AuthButtons";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart-context";
import { useDisplayMode } from "@/lib/display-mode-context";

const ITEMS = [
  { to: "/", icon: Home, labelKey: "bottomNav.home", end: true },
  { to: "/browse", icon: Leaf, labelKey: "bottomNav.browse" },
  { to: "/bulk-buy", icon: Boxes, labelKey: "bottomNav.bulkBuy" },
  { to: "/cart", icon: ShoppingCart, labelKey: "bottomNav.cart", badge: "cart" },
  { to: "/orders", icon: Package, labelKey: "bottomNav.orders" },
  { to: "/transaction-history", icon: ReceiptText, labelKey: "sidebar.transactionHistory" },
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
  const { sidebarExpanded, sidebarWidth, setSidebarExpanded } = useDisplayMode();
  const counts = { cart: totalItems };
  const displayName = user?.display_name || user?.full_name || user?.email || t("profile.user", { defaultValue: "QURBI user" });
  const accountInitial = displayName.trim().charAt(0).toUpperCase() || "Q";

  React.useEffect(() => {
    setSidebarExpanded(false);
    return () => setSidebarExpanded(false);
  }, [setSidebarExpanded]);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-[60] flex flex-col overflow-visible border-r border-white/10 bg-gradient-to-b from-[#41362D] to-[#6B594A] shadow-[4px_0_24px_rgba(65,54,45,0.3)] transition-[width] duration-300 ease-out"
      style={{ width: sidebarWidth, viewTransitionName: "qurbi-desktop-sidebar" }}
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) {
          setSidebarExpanded(false);
        }
      }}
      onFocusCapture={() => setSidebarExpanded(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setSidebarExpanded(false);
        }
      }}
    >
      <div className={`relative flex min-h-[76px] items-center border-b border-white/15 ${sidebarExpanded ? "px-6" : "justify-center px-3"}`}>
      <Link
        to="/"
        title={!sidebarExpanded ? "QURBI" : undefined}
        className={`flex min-w-0 items-center gap-2 ${sidebarExpanded ? "" : "justify-center"}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
          <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
        </span>
        {sidebarExpanded ? <span className="text-sm font-bold tracking-[0.16em] text-white">QURBI</span> : null}
      </Link>
      </div>

      <nav
        id="desktop-sidebar-navigation"
        aria-label={tf("nav.label")}
        className={`flex-1 space-y-2 overflow-visible py-5 ${sidebarExpanded ? "px-4" : "px-3"}`}
      >
        {ITEMS.map(({ to, icon: Icon, labelKey, end, badge }) => {
          const count = badge ? counts[badge] : 0;
          const label = t(labelKey);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              title={!sidebarExpanded ? label : undefined}
              className={({ isActive }) =>
                `group relative flex min-h-14 items-center rounded-2xl py-3 text-[15px] font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F] ${sidebarExpanded ? "gap-4 px-4" : "justify-center px-0"} ${
                  isActive
                    ? "bg-gradient-to-r from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                    : `text-white/80 hover:text-white ${sidebarExpanded ? "hover:translate-x-1" : "hover:scale-105"}`
                }`
              }
            >
              <Icon className="h-[22px] w-[22px] flex-none transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
              {sidebarExpanded ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
              {count > 0 && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7EDE2] px-1.5 text-[11px] font-bold text-[#41362D] ring-1 ring-[#41362D]/30 ${sidebarExpanded ? "" : "absolute right-1 top-1"}`}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
              {!sidebarExpanded ? (
                <span role="tooltip" className="pointer-events-none absolute left-full z-[80] ml-3 whitespace-nowrap rounded-lg bg-[#241D18] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {label}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className={`border-t border-white/15 py-4 ${sidebarExpanded ? "px-4" : "px-3"}`}>
        {isAuthenticated && (
          <>
            <NavLink
              to="/profile"
              aria-label={displayName}
              title={!sidebarExpanded ? displayName : undefined}
              className={({ isActive }) =>
                `group min-w-0 rounded-2xl transition-colors duration-200 ${sidebarExpanded ? "block px-3 py-3" : "flex min-h-12 items-center justify-center p-1"} ${
                  isActive ? "bg-white/10" : "hover:bg-white/[0.06]"
                }`
              }
            >
              {sidebarExpanded ? (
                <>
                  <p className="truncate text-[15px] font-bold leading-tight text-white">{displayName}</p>
                  {user?.email ? <p className="mt-1 truncate text-xs text-white/65" title={user.email}>{user.email}</p> : null}
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E3C19F]">
                    {t("sidebar.profile")}
                  </p>
                </>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E3C19F] bg-white/10 text-sm font-bold text-white">
                  {accountInitial}
                </span>
              )}
            </NavLink>
            <div className="my-3 h-px bg-white/15" aria-hidden="true" />
          </>
        )}
        <AuthButtons onDark compact={!sidebarExpanded} />
      </div>
    </aside>
  );
}
