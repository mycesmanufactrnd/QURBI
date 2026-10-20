import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Camera, CheckCircle2, CloudOff, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-kit";
import LiveCamera from "@/components/LiveCamera";
import { proofQueue } from "@/lib/proofSubmission";
import { errorText } from "@/lib/format";

/**
 * Take the required live photos, add the step's own fields (checklist, code,
 * reason), then send through the offline-safe proof queue.
 *
 * The server takes ONE capture time and ONE GPS reading per step, so the
 * reading of the LAST photo is sent as the step's metadata; every photo still
 * carries its own time and place printed on it.
 *
 * @param {{
 *   stage: "pickup" | "transit" | "deliver" | "fail",
 *   stageKey: "pickup" | "transit" | "delivery" | "failed",
 *   order: { orderId: string, orderNumber: string },
 *   title: string,
 *   subtitle?: string,
 *   slots: { key: string, label: string }[],
 *   submitLabel: string,
 *   canSubmit?: boolean,
 *   buildBody?: () => object,
 *   children?: React.ReactNode,
 *   onSent: () => void,
 *   onQueued: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ProofFlow({ stage, stageKey, order, title, subtitle, slots, submitLabel, canSubmit = true, buildBody, children, onSent, onQueued, onCancel }) {
  const { t } = useTranslation(["proof", "common"]);
  const [photos, setPhotos] = useState(() => slots.map(() => null));
  const [cameraSlot, setCameraSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const urlsRef = useRef([]);

  // Preview urls are ours until the screen closes.
  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const useCapturedPhoto = (photo) => {
    urlsRef.current.push(photo.previewUrl);
    setPhotos((current) => {
      const next = [...current];
      if (next[cameraSlot]) URL.revokeObjectURL(next[cameraSlot].previewUrl);
      next[cameraSlot] = photo;
      return next;
    });
    setCameraSlot(null);
  };

  const allTaken = photos.every(Boolean);
  const stageLabel = t(`stage.${stageKey}`, { ns: "proof" });

  const submit = async () => {
    if (!allTaken || !canSubmit || submitting) return;
    setSubmitting(true);
    setOutcome(null);
    try {
      const last = photos[photos.length - 1];
      const result = await proofQueue.submit({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        stage,
        photos: photos.map((photo) => photo.blob),
        body: { meta: last.meta, ...(buildBody ? buildBody() : {}) },
      });
      if (result.status === "sent") { onSent(); return; }
      if (result.status === "queued") { setOutcome({ kind: "queued" }); return; }
      // The server said no. The courier is looking at the reason right now, so
      // the failed entry is dropped instead of lingering in the global list.
      await proofQueue.dismiss(result.id);
      setOutcome({ kind: "rejected", message: errorText(result.error, t) });
    } catch (error) {
      setOutcome({ kind: "rejected", message: errorText(error, t) });
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome?.kind === "queued") {
    return (
      <div className="animate-fade-in space-y-4">
        <Card>
          <div className="flex flex-col items-center px-2 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><CloudOff className="h-7 w-7" aria-hidden="true" /></span>
            <h2 className="mt-4 text-lg font-extrabold">{t("submit.queuedTitle", { ns: "proof" })}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t("submit.queuedBody", { ns: "proof" })}</p>
          </div>
        </Card>
        <Button className="h-12 w-full" onClick={onQueued}>{t("submit.backToJob", { ns: "proof" })}</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={title} description={subtitle} backTo={undefined} />

      {outcome?.kind === "rejected" && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-extrabold text-destructive">{t("submit.rejectedTitle", { ns: "proof" })}</p>
            <p className="mt-1 break-words text-foreground">{t("submit.rejectedBody", { ns: "proof" })} {outcome.message}</p>
          </div>
        </div>
      )}

      <Card title={t("review.title", { ns: "proof" })} description={t("review.hint", { ns: "proof" })}>
        <ul className="grid gap-3">
          {slots.map((slot, index) => {
            const photo = photos[index];
            return (
              <li key={slot.key} className="flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                  {photo ? <img src={photo.previewUrl} alt={slot.label} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Camera className="h-6 w-6" aria-hidden="true" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{slot.label}</p>
                  <Button type="button" variant={photo ? "outline" : "default"} className="mt-1.5 h-11" onClick={() => setCameraSlot(index)} disabled={submitting}>
                    {photo ? <><RotateCcw className="h-4 w-4" />{t("review.retake", { ns: "proof" })}</> : <><Camera className="h-4 w-4" />{t("camera.capture", { ns: "proof" })}</>}
                  </Button>
                </div>
                {photo && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label={t("submit.sent", { ns: "proof" })} />}
              </li>
            );
          })}
        </ul>
      </Card>

      {children}

      {!allTaken && <p className="text-center text-xs font-semibold text-muted-foreground">{t("review.missing", { ns: "proof" })}</p>}
      <div className="grid grid-cols-[1fr_1.6fr] gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel} disabled={submitting}>{t("cancel", { ns: "common" })}</Button>
        <Button type="button" className="h-12" onClick={submit} disabled={!allTaken || !canSubmit || submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t("submit.sending", { ns: "proof" })}</> : submitLabel}
        </Button>
      </div>

      {cameraSlot !== null && (
        <LiveCamera
          orderNumber={order.orderNumber}
          stageLabel={stageLabel}
          photoLabel={slots[cameraSlot].label}
          step={{ current: cameraSlot + 1, total: slots.length }}
          onUse={useCapturedPhoto}
          onClose={() => setCameraSlot(null)}
        />
      )}
    </div>
  );
}
