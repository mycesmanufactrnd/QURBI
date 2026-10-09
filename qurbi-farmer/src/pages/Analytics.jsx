import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Eye,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { qurbi } from "@/api/qurbiClient";
import { Image } from "@/components/ui/image";
import NotificationBell from "@/components/agri/NotificationBell";

const PERIODS = [7, 30, 90];

export default function Analytics() {
  const { t, i18n } = useTranslation("analytics");
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllListings, setShowAllListings] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await qurbi.analytics.summary(days));
    } catch (requestError) {
      setError(requestError.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const chartDays = useMemo(() => (data?.daily || []).slice(days > 14 ? -14 : 0), [data, days]);
  const chartMax = Math.max(1, ...chartDays.map((row) => row.views));
  const totals = data?.totals || {};
  const topListings = data?.topListings || [];
  const recentActivity = data?.recentActivity || [];
  const visibleListings = showAllListings ? topListings : topListings.slice(0, 5);
  const visibleActivity = showAllActivity ? recentActivity : recentActivity.slice(0, 5);

  return (
    <div className="animate-fade-in">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </div>
        <NotificationBell />
      </header>

      <div className="mt-5 grid grid-cols-3 rounded-2xl bg-muted/70 p-1" aria-label={t("periodLabel")}>
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setDays(period)}
            className={`min-h-11 rounded-xl px-3 text-sm font-bold transition-all ${days === period ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("days", { count: period })}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <button type="button" onClick={load} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">
            <RefreshCw className="h-4 w-4" /> {t("retry")}
          </button>
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t("overview") }>
        <MetricCard icon={Eye} label={t("metrics.views")} value={loading ? "—" : totals.listingViews || 0} tone="primary" />
        <MetricCard icon={Users} label={t("metrics.visitors")} value={loading ? "—" : totals.uniqueVisitors || 0} tone="blue" />
        <MetricCard icon={ShoppingCart} label={t("metrics.cart")} value={loading ? "—" : totals.addToCart || 0} tone="amber" />
        <MetricCard icon={Zap} label={t("metrics.buyIntent")} value={loading ? "—" : totals.buyNow || 0} tone="green" />
        <MetricCard icon={UserRound} label={t("metrics.farmViews")} value={loading ? "—" : totals.farmerProfileViews || 0} tone="purple" />
      </section>

      <section className="soft-card mt-6 p-5" aria-labelledby="interest-chart-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="interest-chart-title" className="text-lg font-extrabold">{t("trend.title")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("trend.subtitle", { count: chartDays.length })}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary"><BarChart3 className="h-5 w-5" /></span>
        </div>
        <div className="mt-5 flex h-40 items-end gap-2 border-b border-border/70 pb-2">
          {loading
            ? Array.from({ length: 7 }, (_, index) => <div key={index} className="h-3/4 flex-1 animate-pulse rounded-t-lg bg-muted" />)
            : chartDays.map((row) => (
              <div key={row.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-bold text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{row.views}</span>
                <div
                  className="w-full min-w-2 rounded-t-lg bg-primary/85 transition-all group-hover:bg-primary"
                  style={{ height: `${Math.max(row.views ? 8 : 2, (row.views / chartMax) * 100)}%` }}
                  title={t("trend.barLabel", { date: formatDay(row.date, i18n.language), count: row.views })}
                />
                <span className="hidden text-[10px] text-muted-foreground sm:block">{formatDay(row.date, i18n.language)}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="funnel-title">
        <h2 id="funnel-title" className="text-lg font-extrabold">{t("funnel.title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("funnel.subtitle")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RateCard icon={ShoppingCart} value={totals.viewToCartRate || 0} label={t("funnel.viewToCart")} hint={t("funnel.viewToCartHint")} />
          <RateCard icon={Sparkles} value={totals.viewToBuyRate || 0} label={t("funnel.viewToBuy")} hint={t("funnel.viewToBuyHint")} />
        </div>
      </section>

      <section className="mt-7" aria-labelledby="top-listings-title">
        <h2 id="top-listings-title" className="text-lg font-extrabold">{t("top.title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("top.subtitle")}</p>
        <div className="mt-3 space-y-2.5">
          {!loading && !topListings.length ? (
            <EmptyAnalytics title={t("top.emptyTitle")} body={t("top.emptyBody")} />
          ) : visibleListings.map((item, index) => (
            <button
              key={`${item.targetType}:${item.targetId}`}
              type="button"
              onClick={() => navigate(item.targetType === "bulk_listing" ? `/bulk/${item.targetId}` : `/livestock/${item.targetId}`)}
              className="soft-card flex min-h-[82px] w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/35"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-extrabold text-primary">{index + 1}</span>
              <Image src={item.image || ""} alt="" fittingType="fill" className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{item.title || t("unknownListing")}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                  <span>{t("top.views", { count: item.views })}</span>
                  <span>{t("top.cart", { count: item.addToCart })}</span>
                  <span>{t("top.intent", { count: item.buyNow })}</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
        {topListings.length > 5 && <ExpandButton expanded={showAllListings} count={topListings.length} onClick={() => setShowAllListings((shown) => !shown)} t={t} />}
      </section>

      <section className="mt-7" aria-labelledby="activity-title">
        <h2 id="activity-title" className="text-lg font-extrabold">{t("activity.title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("activity.privacy")}</p>
        <div className="soft-card mt-3 divide-y divide-border/60 overflow-hidden">
          {!loading && !recentActivity.length ? (
            <EmptyAnalytics title={t("activity.emptyTitle")} body={t("activity.emptyBody")} />
          ) : visibleActivity.map((item) => {
            const config = activityConfig(item.eventType, t);
            const Icon = config.icon;
            return (
              <div key={item.id} className="flex min-h-[76px] items-center gap-3 px-4 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${config.tone}`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{config.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.title || t("unknownListing")} · {item.visitorType === "signed_in" ? t("activity.signedIn") : t("activity.guest")}</span>
                </span>
                <time className="shrink-0 text-[11px] font-semibold text-muted-foreground">{relativeTime(item.occurredAt, i18n.language, t)}</time>
              </div>
            );
          })}
        </div>
        {recentActivity.length > 5 && <ExpandButton expanded={showAllActivity} count={recentActivity.length} onClick={() => setShowAllActivity((shown) => !shown)} t={t} />}
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }) {
  const tones = {
    primary: "bg-secondary text-primary",
    blue: "bg-sky-100 text-sky-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    purple: "bg-violet-100 text-violet-700",
  };
  return (
    <div className="soft-card min-w-0 p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground sm:text-sm">{label}</p>
    </div>
  );
}

function RateCard({ icon: Icon, value, label, hint }) {
  return (
    <div className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-3xl font-extrabold text-primary">{value}%</p><p className="mt-1 text-sm font-bold">{label}</p></div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  );
}

function EmptyAnalytics({ title, body }) {
  return (
    <div className="flex flex-col items-center px-5 py-9 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><MousePointerClick className="h-6 w-6" /></span>
      <p className="mt-3 text-sm font-extrabold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ExpandButton({ expanded, count, onClick, t }) {
  return <button type="button" onClick={onClick} aria-expanded={expanded} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-primary transition-colors hover:bg-muted/40">{expanded ? t("showLess") : t("viewAll", { count })}<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>;
}

function activityConfig(type, t) {
  if (type === "add_to_cart") return { icon: ShoppingCart, label: t("activity.addToCart"), tone: "bg-amber-100 text-amber-700" };
  if (type === "buy_now") return { icon: Zap, label: t("activity.buyNow"), tone: "bg-emerald-100 text-emerald-700" };
  if (type === "farmer_profile_view") return { icon: UserRound, label: t("activity.farmView"), tone: "bg-sky-100 text-sky-700" };
  return { icon: Eye, label: t("activity.listingView"), tone: "bg-secondary text-primary" };
}

function formatDay(value, language) {
  return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function relativeTime(value, language, t) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return t("activity.now");
  const formatter = new Intl.RelativeTimeFormat(language === "ms" ? "ms-MY" : "en", { numeric: "auto" });
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}
