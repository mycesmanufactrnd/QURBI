import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui-kit";
import ProofFlow from "@/components/ProofFlow";
import { cn } from "@/lib/utils";

const FAILURE_CATEGORIES = ["buyer_unreachable", "wrong_address", "livestock_issue", "vehicle_issue", "other"];

/** Pickup: the three safety checks, then one photo of the animal at the farm. */
export function PickupFlow({ order, onSent, onQueued, onCancel }) {
  const { t } = useTranslation(["jobs", "proof"]);
  const [checklist, setChecklist] = useState({ earTagMatches: false, animalHealthy: false, animalSecured: false });
  const allChecked = Object.values(checklist).every(Boolean);
  const toggle = (key) => (checked) => setChecklist((current) => ({ ...current, [key]: checked === true }));

  return (
    <ProofFlow
      stage="pickup"
      stageKey="pickup"
      order={order}
      title={t("pickupFlow.title", { ns: "jobs" })}
      slots={[{ key: "animal", label: t("photoLabels.pickup", { ns: "proof" }) }]}
      submitLabel={t("pickupFlow.submit", { ns: "jobs" })}
      canSubmit={allChecked}
      buildBody={() => ({ checklist })}
      onSent={onSent}
      onQueued={onQueued}
      onCancel={onCancel}
    >
      <Card title={t("pickupFlow.checklistTitle", { ns: "jobs" })}>
        <div className="space-y-3">
          {[["earTagMatches", "earTag"], ["animalHealthy", "healthy"], ["animalSecured", "secured"]].map(([key, copy]) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3">
              <Checkbox checked={checklist[key]} onCheckedChange={toggle(key)} className="mt-0.5" />
              <span className="text-sm leading-relaxed">{t(`pickupFlow.${copy}`, { ns: "jobs" })}</span>
            </label>
          ))}
        </div>
        {!allChecked && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t("pickupFlow.blocked", { ns: "jobs" })}</p>}
      </Card>
    </ProofFlow>
  );
}

/** Leaving the farm: one live photo, and the buyer is told the animal is on the way. */
export function TransitFlow({ order, onSent, onQueued, onCancel }) {
  const { t } = useTranslation(["jobs", "proof"]);
  return (
    <ProofFlow
      stage="transit"
      stageKey="transit"
      order={order}
      title={t("transitFlow.title", { ns: "jobs" })}
      slots={[{ key: "road", label: t("photoLabels.transit", { ns: "proof" }) }]}
      submitLabel={t("transitFlow.submit", { ns: "jobs" })}
      onSent={onSent}
      onQueued={onQueued}
      onCancel={onCancel}
    />
  );
}

/** Handover: the buyer's 6-digit code plus two live photos (the animal, and the handover itself). */
export function DeliverFlow({ order, onSent, onQueued, onCancel }) {
  const { t } = useTranslation(["jobs", "proof"]);
  const [code, setCode] = useState("");
  const valid = /^\d{6}$/.test(code);

  return (
    <ProofFlow
      stage="deliver"
      stageKey="delivery"
      order={order}
      title={t("deliverFlow.title", { ns: "jobs" })}
      slots={[
        { key: "animal", label: t("photoLabels.deliveryAnimal", { ns: "proof" }) },
        { key: "handover", label: t("photoLabels.deliveryHandover", { ns: "proof" }) },
      ]}
      submitLabel={t("deliverFlow.submit", { ns: "jobs" })}
      canSubmit={valid}
      buildBody={() => ({ code })}
      onSent={onSent}
      onQueued={onQueued}
      onCancel={onCancel}
    >
      <Card>
        <Label htmlFor="delivery-code">{t("deliverFlow.codeLabel", { ns: "jobs" })}</Label>
        <Input
          id="delivery-code"
          className="mt-2 h-14 text-center text-2xl font-extrabold tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-describedby="delivery-code-hint"
        />
        <p id="delivery-code-hint" className="mt-2 text-xs text-muted-foreground">{t("deliverFlow.codeHint", { ns: "jobs" })}</p>
      </Card>
    </ProofFlow>
  );
}

/** Something went wrong: a category, what happened, and one live photo as evidence. */
export function ProblemFlow({ order, onSent, onQueued, onCancel }) {
  const { t } = useTranslation(["jobs", "proof"]);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ProofFlow
      stage="fail"
      stageKey="failed"
      order={order}
      title={t("problem.title", { ns: "jobs" })}
      subtitle={t("problem.subtitle", { ns: "jobs" })}
      slots={[{ key: "evidence", label: t("photoLabels.failed", { ns: "proof" }) }]}
      submitLabel={t("problem.submit", { ns: "jobs" })}
      canSubmit={Boolean(category) && reason.trim().length > 0}
      buildBody={() => ({ category, reason: reason.trim() })}
      onSent={onSent}
      onQueued={onQueued}
      onCancel={onCancel}
    >
      <Card title={t("problem.category", { ns: "jobs" })}>
        <div role="radiogroup" aria-label={t("problem.category", { ns: "jobs" })} className="grid gap-2">
          {FAILURE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "min-h-12 rounded-xl border-2 px-3 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                category === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary/40",
              )}
            >
              {t(`problem.categories.${value}`, { ns: "jobs" })}
            </button>
          ))}
        </div>
        <Label htmlFor="problem-reason" className="mt-4 block">{t("problem.reason", { ns: "jobs" })}</Label>
        <Textarea id="problem-reason" className="mt-2" rows={4} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="problem-reason-hint" />
        <p id="problem-reason-hint" className="mt-1.5 text-xs text-muted-foreground">{t("problem.reasonHint", { ns: "jobs" })}</p>
      </Card>
    </ProofFlow>
  );
}
