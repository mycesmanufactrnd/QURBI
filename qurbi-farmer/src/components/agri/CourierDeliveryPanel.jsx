import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, CheckCircle2, Clock3, Loader2, PackageCheck, Star, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { courierJobApi, orderApi } from "@/api/apiClient";
import { cn } from "@/lib/utils";

const STAGE_KEYS = ["pickup", "transit", "delivery", "failed"];

function apiMessage(error, fallback) {
  return error?.message || fallback;
}

/**
 * Where a delivery order stands with its courier, and the two things only the
 * farmer can do: release the order to the courier pool, and confirm the animal
 * was handed over.
 *
 * @param {{
 *   order: any,
 *   summary: any,
 *   events: any[],
 *   ProofImage: React.ElementType,
 *   formatDateTime: (value: string) => string,
 *   onChanged: () => void | Promise<void>,
 * }} props
 */
export default function CourierDeliveryPanel({ order, summary, events = [], ProofImage, formatDateTime, onChanged }) {
  const { t } = useTranslation("orders");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const state = summary?.state || "not_requested";
  const courier = summary?.courier;
  const assignment = summary?.assignment;
  const paid = String(order.payment_status || "").toLowerCase() === "paid";
  const canRelease = state === "not_requested" && paid && ["paid", "processing"].includes(order.status);
  const atPickup = ["accepted", "picked_up"].includes(state);
  const proofEvents = events.filter((event) => event.images?.length);

  const run = async (name, action, fallback) => {
    setBusy(name);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(apiMessage(failure, fallback));
    } finally {
      setBusy("");
    }
  };

  const tone = state === "failed" ? "border-destructive/30 bg-destructive/5" : state === "delivered" ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-card";

  return (
    <section className={cn("rounded-2xl border p-4", tone)} aria-labelledby="courier-panel-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {state === "failed" ? <TriangleAlert className="h-5 w-5" /> : state === "delivered" ? <PackageCheck className="h-5 w-5" /> : <Bike className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="courier-panel-title" className="text-lg font-extrabold">{t("courier.title")}</h2>
          <p className="mt-0.5 text-sm font-semibold">{t(`courier.state.${state}.title`)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(`courier.state.${state}.body`)}</p>
        </div>
      </div>

      {courier && (
        <div className="mt-4 rounded-xl bg-muted/55 p-3">
          <p className="break-words font-extrabold">{courier.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("courier.vehicle", { type: courier.vehicleType, plate: courier.vehiclePlate })}</p>
          {courier.ratingCount > 0 && <p className="mt-1 flex items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{Number(courier.ratingAverage).toFixed(1)} <span className="font-normal text-muted-foreground">({courier.ratingCount})</span></p>}
        </div>
      )}

      {state === "failed" && assignment?.failedReason && <p className="mt-3 break-words rounded-xl bg-background/70 p-3 text-sm"><span className="font-semibold">{t("courier.problem")} </span>{assignment.failedReason}</p>}

      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}

      {canRelease && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">{t("courier.releaseHint")}</p>
          <Button type="button" className="h-12 w-full rounded-2xl text-base font-bold" disabled={Boolean(busy)} onClick={() => run("release", () => orderApi.readyForPickup(order.id), t("courier.releaseFailed"))}>
            {busy === "release" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Bike className="mr-2 h-5 w-5" />}
            {busy === "release" ? t("courier.releasing") : t("courier.release")}
          </Button>
        </div>
      )}

      {atPickup && (
        assignment?.farmerHandoverConfirmedAt ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t("courier.handoverConfirmed")}</p>
        ) : (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">{t("courier.handoverHint")}</p>
            <Button type="button" variant="outline" className="h-12 w-full rounded-2xl text-base font-bold" disabled={Boolean(busy)} onClick={() => run("handover", () => courierJobApi.farmerHandover(order.id), t("courier.handoverFailed"))}>
              {busy === "handover" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
              {busy === "handover" ? t("courier.confirming") : t("courier.confirmHandover")}
            </Button>
          </div>
        )
      )}

      {proofEvents.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
          <h3 className="text-sm font-extrabold">{t("courier.proofTitle")}</h3>
          {proofEvents.map((event) => (
            <div key={event.id}>
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
                {t(`courier.stage.${STAGE_KEYS.includes(event.stage) ? event.stage : "pickup"}`)}
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock3 className="h-3 w-3" aria-hidden="true" />{formatDateTime(event.capturedAt || event.createdAt)}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {event.images.map((url) => <ProofImage key={url} url={url} alt={t("courier.proofAlt")} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
