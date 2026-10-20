import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, MapPin, Package, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui-kit";
import { formatMoney, timeAgo } from "@/lib/format";

export const STEP_ORDER = ["accepted", "picked_up", "in_transit", "delivered"];

export const STATUS_TONE = {
  accepted: "info",
  picked_up: "info",
  in_transit: "primary",
  delivered: "success",
  failed: "danger",
  cancelled: "muted",
};

export const isActiveStatus = (status) => ["accepted", "picked_up", "in_transit"].includes(status);

/** Accepted -> picked up -> on the way -> delivered, with the current step highlighted. */
export function StageStepper({ status }) {
  const { t } = useTranslation("jobs");
  const current = STEP_ORDER.indexOf(status);
  return (
    <ol className="flex items-start" aria-label={t("detail.timeline")}>
      {STEP_ORDER.map((step, index) => {
        const done = index < current || status === "delivered";
        const active = index === current && status !== "delivered";
        return (
          <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {index > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", index <= current || status === "delivered" ? "bg-primary" : "bg-border")} />}
            <span className={cn(
              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold",
              done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-card text-primary ring-4 ring-primary/15" : "border-border bg-card text-muted-foreground",
            )}>
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn("mt-1.5 max-w-full px-0.5 text-[11px] font-semibold leading-tight", done || active ? "text-foreground" : "text-muted-foreground")}>{t(`steps.${step}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One job in a list: where from, where to, what it pays. Tapping opens the job. */
export function JobCard({ job }) {
  const { t, i18n } = useTranslation("jobs");
  const status = job.assignment?.status;
  const summary = job.items.map((item) => (item.quantity > 1 ? `${item.title} ×${item.quantity}` : item.title)).join(", ");
  return (
    <Link
      to={`/jobs/${job.orderId}`}
      className="soft-card group block min-w-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-extrabold">#{job.orderNumber}</span>
              {status && <StatusBadge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</StatusBadge>}
            </p>
            {summary && <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-foreground/80"><Package className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />{summary}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold text-muted-foreground">{t("card.earning")}</p>
            <p className="text-lg font-extrabold text-primary">{formatMoney(job.assignment?.earningAmount ?? job.earning)}</p>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <div className="min-w-0"><dt className="sr-only">{t("card.from")}</dt><dd className="truncate font-semibold">{job.pickupArea?.farmName}<span className="font-normal text-muted-foreground"> · {[job.pickupArea?.city, job.pickupArea?.state].filter(Boolean).join(", ")}</span></dd></div>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <div className="min-w-0"><dt className="sr-only">{t("card.to")}</dt><dd className="truncate font-semibold">{[job.dropoffArea?.city, job.dropoffArea?.state].filter(Boolean).join(", ")}{job.distanceKm != null && <span className="font-normal text-muted-foreground"> · {t("card.distance", { km: job.distanceKm })}</span>}</dd></div>
          </div>
        </dl>
      </div>
      <div className="flex min-h-11 items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2 text-sm font-bold text-primary">
        <span className="text-xs font-semibold text-muted-foreground">{job.readyForPickupAt ? t("card.ready", { time: timeAgo(job.readyForPickupAt, i18n.language) }) : ""}</span>
        <span className="flex items-center gap-1">{t("card.open")}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </div>
    </Link>
  );
}
