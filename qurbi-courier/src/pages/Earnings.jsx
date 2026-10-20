import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BadgeDollarSign, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, EmptyState, ErrorNotice, ListSkeleton, PageHeader } from "@/components/ui-kit";
import { courierApi, jobsApi } from "@/api/apiClient";
import { errorText, formatDate, formatDateTime, formatMoney } from "@/lib/format";

const PERIODS = ["today", "week", "month", "allTime"];

export default function Earnings() {
  const { t, i18n } = useTranslation(["earnings", "common"]);
  const locale = i18n.language === "ms" ? "ms-MY" : "en-MY";
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    try {
      setState({ loading: false, error: "", data: await jobsApi.earnings() });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorText(error, t) }));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const { data } = state;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={t("title", { ns: "earnings" })} />
      <ErrorNotice message={state.error} onRetry={load} retryLabel={t("retry", { ns: "common" })} />
      {state.loading && <ListSkeleton />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PERIODS.map((period) => (
              <div key={period} className="soft-card p-4">
                <p className="text-xs font-semibold text-muted-foreground">{t(`totals.${period}`, { ns: "earnings" })}</p>
                <p className="mt-1 text-xl font-extrabold tracking-tight">{formatMoney(data.totals[period])}</p>
                <p className="text-xs text-muted-foreground">{t("deliveries", { ns: "earnings", count: data.deliveries[period] })}</p>
              </div>
            ))}
          </div>

          <RateCard rate={data.rate} onChanged={load} />

          <Card title={t("weeks.title", { ns: "earnings" })}>
            {data.weeks.length ? (
              <ul className="divide-y divide-border/60">
                {data.weeks.map((week) => (
                  <li key={week.weekStart} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{t("weeks.weekOf", { ns: "earnings", date: formatDate(week.weekStart, locale) })}</p>
                      <p className="text-xs text-muted-foreground">{t("deliveries", { ns: "earnings", count: week.deliveries })}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold">{formatMoney(week.amount)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t("weeks.empty", { ns: "earnings" })}</p>}
          </Card>

          <Card title={t("recent.title", { ns: "earnings" })}>
            {data.recent.length ? (
              <ul className="divide-y divide-border/60">
                {data.recent.map((row) => (
                  <li key={row.orderId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/jobs/${row.orderId}`} className="text-sm font-bold underline-offset-2 hover:underline">#{row.orderNumber}</Link>
                      <p className="text-xs text-muted-foreground">{formatDateTime(row.deliveredAt, locale)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold text-emerald-700">{formatMoney(row.amount)}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={Wallet} title={t("recent.empty", { ns: "earnings" })} className="border-0 py-6 shadow-none" />}
          </Card>
        </>
      )}
    </div>
  );
}

/** Shows the approved rate and lets the courier ask for a new one (an admin approves it). */
function RateCard({ rate, onChanged }) {
  const { t } = useTranslation("earnings");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: "", text: "" });

  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value < 1 || value > 1000;

  const submit = async (event) => {
    event.preventDefault();
    if (invalid) { setMessage({ kind: "error", text: t("rate.invalid") }); return; }
    setBusy(true);
    setMessage({ kind: "", text: "" });
    try {
      await courierApi.proposeRate(Number(value.toFixed(2)));
      setMessage({ kind: "ok", text: t("rate.sent") });
      setOpen(false);
      setAmount("");
      onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error, t) || t("rate.failed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("rate.title")} action={<BadgeDollarSign className="h-5 w-5 text-primary" aria-hidden="true" />}>
      {rate.approvedFee ? (
        <p className="text-sm text-muted-foreground">{t("rate.approved")}: <span className="text-lg font-extrabold text-foreground">{formatMoney(rate.approvedFee)}</span> {t("rate.perDelivery")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("rate.none")}</p>
      )}
      {rate.status === "pending" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{t("rate.pending", { fee: rate.proposedFee })}</p>}
      {rate.status === "rejected" && rate.rejectionReason && <p className="mt-3 break-words rounded-xl bg-destructive/5 p-3 text-sm">{t("rate.rejected", { reason: rate.rejectionReason })}</p>}
      {message.text && <p role={message.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm font-semibold ${message.kind === "error" ? "text-destructive" : "text-emerald-700"}`}>{message.text}</p>}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <Label htmlFor="rate-amount">{t("rate.amount")}</Label>
          <Input id="rate-amount" inputMode="decimal" className="h-12" value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby="rate-hint" autoFocus />
          <p id="rate-hint" className="text-xs text-muted-foreground">{t("rate.proposeHint")}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={busy}>{t("cancel", { ns: "common" })}</Button>
            <Button type="submit" className="h-11" disabled={busy || !amount}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />{t("rate.sending")}</> : t("rate.submit")}</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="mt-4 h-11" onClick={() => { setOpen(true); setMessage({ kind: "", text: "" }); }}>{t("rate.propose")}</Button>
      )}
    </Card>
  );
}
