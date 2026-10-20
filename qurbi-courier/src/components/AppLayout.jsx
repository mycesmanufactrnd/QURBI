import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, CircleAlert, CloudUpload, Home, PackageSearch, UserRound, WifiOff, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/useOnline";
import { useProofQueue } from "@/hooks/useProofQueue";
import BrandLogo from "@/components/BrandLogo";

const ITEMS = [
  { to: "/jobs", labelKey: "jobs", icon: PackageSearch },
  { to: "/earnings", labelKey: "earnings", icon: Wallet },
  { to: "/", labelKey: "home", icon: Home, end: true, featured: true },
  { to: "/profile", labelKey: "profile", icon: UserRound },
];

export default function AppLayout() {
  const { t } = useTranslation(["nav", "common"]);
  const online = useOnline();
  const queue = useProofQueue();

  return (
    <div className="min-h-dvh bg-background">
      <div className="lg:mx-auto lg:max-w-3xl">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <Link to="/" aria-label={t("home", { ns: "nav" })}><BrandLogo /></Link>
          <Link to="/notifications" className="flex h-11 items-center gap-2 rounded-full bg-secondary/70 px-4 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Bell className="h-4 w-4" aria-hidden="true" />{t("notifications", { ns: "nav" })}
          </Link>
        </header>

        {!online && (
          <div role="status" className="flex items-start gap-2.5 bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t("offlineBanner", { ns: "common" })}
          </div>
        )}
        {queue.pending > 0 && (
          <div role="status" className="flex items-center gap-2.5 bg-sky-100 px-5 py-2.5 text-sm font-semibold text-sky-900">
            <CloudUpload className="h-4 w-4 shrink-0" aria-hidden="true" />{t("queue.pending", { ns: "common", count: queue.pending })}
          </div>
        )}
        {queue.failedItems.length > 0 && (
          <section aria-label={t("queue.failedTitle", { ns: "common" })} className="space-y-2 bg-red-50 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-extrabold text-red-800"><CircleAlert className="h-4 w-4" aria-hidden="true" />{t("queue.failedTitle", { ns: "common" })}</p>
            <p className="text-xs text-red-800/80">{t("queue.failedHint", { ns: "common" })}</p>
            <ul className="space-y-2">
              {queue.failedItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">#{item.orderNumber} · {t(`stage.${item.stage === "deliver" ? "delivery" : item.stage === "fail" ? "failed" : item.stage}`, { ns: "proof" })}</p>
                    <p className="break-words text-xs text-muted-foreground">{item.lastError}</p>
                    <Link to={`/jobs/${item.orderId}`} className="mt-1 inline-flex min-h-9 items-center text-xs font-bold text-primary underline underline-offset-2">{t("queue.openJob", { ns: "common" })}</Link>
                  </div>
                  <button type="button" onClick={() => queue.dismiss(item.id)} aria-label={t("queue.dismiss", { ns: "common" })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <main className="px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-5">
          <Outlet />
        </main>
      </div>

      <nav aria-label={t("courierNavigation", { ns: "nav" })} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
        <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[2rem] border border-border/70 bg-card/95 p-2 shadow-[0_14px_38px_rgba(65,54,45,0.18)] backdrop-blur-xl">
          {ITEMS.map(({ to, labelKey, icon: Icon, end, featured }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                featured && "-mt-5",
                isActive ? "text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    featured && "h-12 w-12 shadow-[0_7px_18px_rgba(65,54,45,0.24)]",
                    isActive && !featured && "bg-secondary",
                    featured && (isActive ? "brand-gradient text-white" : "bg-secondary text-primary"),
                  )}>
                    <Icon className={cn("h-5 w-5", featured && "h-6 w-6")} strokeWidth={isActive ? 2.6 : 2} aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate">{t(labelKey, { ns: "nav" })}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
