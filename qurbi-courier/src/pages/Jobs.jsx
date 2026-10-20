import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PackageSearch, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNotice, ListSkeleton, PageHeader } from "@/components/ui-kit";
import { JobCard } from "@/components/JobParts";
import { courierApi, jobsApi } from "@/api/apiClient";
import { errorText } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const TABS = ["available", "active", "history"];
// The pool changes whenever a farmer releases an order, so keep it fresh
// without the courier having to pull to refresh.
const POOL_REFRESH_MS = 30_000;

export default function Jobs() {
  const { t } = useTranslation(["jobs", "home", "common"]);
  const { user, checkUserAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = TABS.includes(tabParam) ? tabParam : "available";
  const [state, setState] = useState({ loading: true, error: "", offline: false, jobs: [] });
  const [goingOnline, setGoingOnline] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      if (tab === "available") {
        const result = await jobsApi.available();
        setState({ loading: false, error: "", offline: result.offline, jobs: result.jobs });
      } else {
        const jobs = await jobsApi.mine(tab === "history" ? "history" : "active");
        setState({ loading: false, error: "", offline: false, jobs });
      }
    } catch (error) {
      // A failed background refresh must not wipe a list that is already on screen.
      if (silent) return;
      setState((current) => ({ ...current, loading: false, error: errorText(error, t) }));
    }
  }, [tab, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "available") return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) load({ silent: true }); }, POOL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [tab, load]);

  const goOnline = async () => {
    setGoingOnline(true);
    try {
      await courierApi.setOnline(true);
      await checkUserAuth();
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: errorText(error, t) }));
    } finally {
      setGoingOnline(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title={t("title", { ns: "jobs" })}
        actions={<Button variant="outline" size="icon" onClick={() => load()} disabled={state.loading} aria-label={t("refresh", { ns: "common" })} className="h-11 w-11 rounded-2xl"><RefreshCw className={cn("h-4 w-4", state.loading && "animate-spin")} /></Button>}
      />

      <div role="tablist" aria-label={t("title", { ns: "jobs" })} className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setSearchParams(name === "available" ? {} : { tab: name }, { replace: true })}
            className={cn("min-h-11 rounded-xl px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === name ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t(`tabs.${name}`, { ns: "jobs" })}
          </button>
        ))}
      </div>

      <ErrorNotice message={state.error} onRetry={() => load()} retryLabel={t("retry", { ns: "common" })} />

      {state.loading ? <ListSkeleton /> : state.error ? null : tab === "available" && state.offline ? (
        <EmptyState
          icon={WifiOff}
          title={t("offline.title", { ns: "jobs" })}
          description={t("offline.body", { ns: "jobs" })}
          action={<Button className="h-12" onClick={goOnline} disabled={goingOnline || !user}>{t("offline.action", { ns: "jobs" })}</Button>}
        />
      ) : state.jobs.length ? (
        <div className="grid gap-3">{state.jobs.map((job) => <JobCard key={job.orderId} job={job} />)}</div>
      ) : (
        <EmptyState icon={PackageSearch} title={t(`empty.${tab}`, { ns: "jobs" })} description={t(`empty.${tab}Hint`, { ns: "jobs" })} />
      )}
    </div>
  );
}
