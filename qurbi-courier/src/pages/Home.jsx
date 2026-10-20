import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, PackageSearch, Power, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/ui-kit";
import { JobCard } from "@/components/JobParts";
import { courierApi, jobsApi } from "@/api/apiClient";
import { errorText, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export default function Home() {
  const { t } = useTranslation(["home", "common"]);
  const { user, checkUserAuth } = useAuth();
  const profile = user?.courierProfile;
  const [data, setData] = useState({ loading: true, error: "", jobs: [], earnings: null });
  const [toggling, setToggling] = useState(false);
  const [statusError, setStatusError] = useState("");

  const load = useCallback(async () => {
    try {
      const [jobs, earnings] = await Promise.all([jobsApi.mine("active"), jobsApi.earnings()]);
      setData({ loading: false, error: "", jobs, earnings });
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: errorText(error, t) }));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const toggleOnline = async (online) => {
    setToggling(true);
    setStatusError("");
    try {
      await courierApi.setOnline(online);
      await checkUserAuth();
    } catch (error) {
      setStatusError(errorText(error, t) || t("status.failed", { ns: "home" }));
    } finally {
      setToggling(false);
    }
  };

  const online = Boolean(profile?.isOnline);
  const name = user?.fullName?.split(" ")[0] || "";
  const earnings = data.earnings;
  const needsRate = earnings && !earnings.rate.approvedFee;

  return (
    <div className="animate-fade-in space-y-5">
      <section className="home-brand-hero -mx-5 -mt-5 px-5 pb-7 pt-6 text-white">
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">{t("greeting", { ns: "home", name })}</p>
          <div className="mt-3 flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
            <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", online ? "bg-emerald-400/90 text-emerald-950" : "bg-white/15 text-white")}><Power className="h-6 w-6" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">{online ? t("status.online", { ns: "home" }) : t("status.offline", { ns: "home" })}</p>
              <p className="text-sm text-white/75">{online ? t("status.onlineHint", { ns: "home" }) : t("status.offlineHint", { ns: "home" })}</p>
            </div>
            <Switch checked={online} onCheckedChange={toggleOnline} disabled={toggling || !profile} aria-label={online ? t("status.goOffline", { ns: "home" }) : t("status.goOnline", { ns: "home" })} />
          </div>
        </div>
      </section>

      <ErrorNotice message={statusError} />
      <ErrorNotice message={data.error} onRetry={load} retryLabel={t("retry", { ns: "common" })} />

      {earnings && (
        <Link to="/earnings" className="soft-card flex items-center gap-4 p-4 transition-all hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Wallet className="h-6 w-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground">{t("today", { ns: "home" })}</p>
            <p className="text-2xl font-extrabold tracking-tight">{formatMoney(earnings.totals.today)}</p>
            <p className="text-xs text-muted-foreground">{t("deliveriesToday", { ns: "home", count: earnings.deliveries.today })}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      {needsRate && (
        <section className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900">
          <p className="font-extrabold">{earnings.rate.status === "pending" ? t("ratePending", { ns: "home", fee: earnings.rate.proposedFee }) : t("rateTitle", { ns: "home" })}</p>
          {earnings.rate.status !== "pending" && <p className="mt-1 text-sm">{t("rateBody", { ns: "home" })}</p>}
          {earnings.rate.status !== "pending" && <Button asChild className="mt-3 h-11"><Link to="/earnings">{t("rateAction", { ns: "home" })}</Link></Button>}
        </section>
      )}

      <section aria-labelledby="active-heading">
        <div className="flex items-center justify-between">
          <h2 id="active-heading" className="text-lg font-extrabold tracking-tight">{t("activeJobs", { ns: "home" })}</h2>
          <Link to="/jobs?tab=active" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-primary hover:bg-secondary/60">{t("viewAll", { ns: "home" })}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="mt-2">
          {data.loading ? <ListSkeleton rows={2} /> : data.jobs.length ? (
            <div className="grid gap-3">{data.jobs.slice(0, 3).map((job) => <JobCard key={job.orderId} job={job} />)}</div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title={t("noActive", { ns: "home" })}
              description={t("noActiveHint", { ns: "home" })}
              action={<Button asChild className="h-12"><Link to="/jobs">{t("browseJobs", { ns: "home" })}</Link></Button>}
            />
          )}
        </div>
      </section>
    </div>
  );
}
