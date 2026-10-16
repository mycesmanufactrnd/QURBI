import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Boxes, Home, Leaf, Package, ReceiptText, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import AuthButtons from "@/components/AuthButtons";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart-context";
import ProfileAvatar from "@/components/ProfileAvatar";

const ITEMS = [
  { to: "/", icon: Home, labelKey: "bottomNav.home", end: true },
  { to: "/browse", icon: Leaf, labelKey: "bottomNav.browse" },
  { to: "/bulk-buy", icon: Boxes, labelKey: "bottomNav.bulkBuy" },
  { to: "/cart", icon: ShoppingCart, labelKey: "bottomNav.cart", badge: "cart" },
  { to: "/orders", icon: Package, labelKey: "bottomNav.orders" },
  { to: "/transaction-history", icon: ReceiptText, labelKey: "sidebar.transactionHistory" },
];

/** Permanent desktop navigation. Mobile uses BottomNav instead. */
export default function Sidebar() {
  const { t, i18n } = useTranslation("common");
  const { t: tf } = useTranslation("shopflow");
  const { t: tp } = useTranslation("profile");
  const { user, isAuthenticated } = useAuth();
  const { totalItems = 0 } = useCart() || {};
  const counts = { cart: totalItems };
  const displayName =
    user?.display_name ||
    user?.full_name ||
    user?.email ||
    t("profile.user", { defaultValue: "QURBI user" });

  return (
    <aside
      className="sticky top-0 z-[60] flex h-dvh w-[260px] flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#41362D] to-[#6B594A] shadow-[4px_0_24px_rgba(65,54,45,0.3)]"
      style={{ viewTransitionName: "qurbi-desktop-sidebar" }}
    >
      <div className="flex min-h-[76px] items-center gap-3 border-b border-white/15 px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold tracking-[0.16em] text-white">QURBI</span>
        </Link>

        <div
          className="ml-auto grid grid-cols-2 rounded-xl border border-[#E3C19F]/55 bg-black/10 p-1"
          role="radiogroup"
          aria-label={tp("language.title")}
        >
          {[
            { code: "en", shortLabel: "EN", label: tp("language.english") },
            { code: "ms", shortLabel: "BM", label: tp("language.malay") },
          ].map(({ code, shortLabel, label }) => {
            const selected = i18n.resolvedLanguage === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                onClick={() => i18n.changeLanguage(code)}
                className={`flex h-8 min-w-9 items-center justify-center rounded-lg px-2 text-[11px] font-extrabold tracking-wide transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7EDE2] ${
                  selected
                    ? "bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-sm"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <nav id="desktop-sidebar-navigation" aria-label={tf("nav.label")} className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {ITEMS.map(({ to, icon: Icon, labelKey, end, badge }) => {
          const count = badge ? counts[badge] : 0;
          const label = t(labelKey);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                `group relative flex min-h-14 items-center gap-4 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F] ${
                  isActive
                    ? "bg-gradient-to-r from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                    : "text-white/80 hover:translate-x-1 hover:text-white"
                }`
              }
            >
              <Icon className="h-[22px] w-[22px] flex-none transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7EDE2] px-1.5 text-[11px] font-bold text-[#41362D] ring-1 ring-[#41362D]/30">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/15 px-4 py-4">
        {isAuthenticated && (
          <>
            <NavLink
              to="/profile"
              data-profile-trigger
              aria-label={displayName}
              className={({ isActive }) =>
                `group block min-w-0 px-3 py-3 transition-transform duration-200 ease-out hover:translate-x-1 ${isActive ? "text-white" : "text-white/90"}`
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  src={user?.avatarUrl || user?.avatar_url}
                  name={displayName}
                  className="h-10 w-10 rounded-full text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-tight text-white transition-colors duration-200 group-hover:text-[#E3C19F]">{displayName}</p>
                  {user?.email ? <p className="mt-1 truncate text-xs text-white/65" title={user.email}>{user.email}</p> : null}
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E3C19F]">{t("sidebar.profile")}</p>
                </div>
              </div>
            </NavLink>
            <div className="my-3 h-px bg-white/15" aria-hidden="true" />
          </>
        )}
        <AuthButtons onDark />
      </div>
    </aside>
  );
}
