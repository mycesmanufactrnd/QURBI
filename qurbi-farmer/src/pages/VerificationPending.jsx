import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { authApi } from "@/api/apiClient";
import BrandLogo from "@/components/agri/BrandLogo";
import StatusBadge from "@/components/agri/StatusBadge";
import { Check, Clock, Loader2, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const STEPS = [
  { key: "sent", state: "done" },
  { key: "review", state: "current" },
  { key: "start", state: "next" },
];

export default function VerificationPending() {
  const { t, i18n } = useTranslation("verification");
  const { user, logout, checkUserAuth } = useAuth();
  const status = user?.data?.verificationStatus || user?.verificationStatus;
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);

  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Not Submitted") return <Navigate to="/verify" replace />;
  if (status === "Rejected") return <Navigate to="/rejected" replace />;

  const checkStatus = async () => {
    setChecking(true);
    try {
      const me = await authApi.me();
      // Only reload the session (which re-routes) when the review result is in.
      if (me?.farmerProfile?.verificationStatus !== "pending") {
        await checkUserAuth?.();
        return;
      }
      setCheckedAt(new Date());
    } catch {
      setCheckedAt(new Date());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent to-background flex flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="flex justify-center"><BrandLogo /></div>

        <div className="flex flex-1 flex-col justify-center animate-fade-in">
          <div className="mt-6 text-center">
            <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
              <Clock className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{t("pending.title")}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("pending.thanks")}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">{t("pending.status")}</span>
              <StatusBadge kind="verification" status="Pending" dot />
            </div>
            <ol className="mt-5 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.key} className="flex gap-3">
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    step.state === "done" ? "bg-emerald-600 text-white" : step.state === "current" ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300" : "bg-muted text-muted-foreground"
                  )}>
                    {step.state === "done" ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-base font-bold">{t(`pending.steps.${step.key}.title`)}</p>
                    <p className="text-sm leading-snug text-muted-foreground">{t(`pending.steps.${step.key}.text`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 break-words border-t border-border pt-3 text-center text-sm text-muted-foreground">{t("pending.linkedTo")} <span className="font-semibold text-foreground">{user?.email || t("pending.yourEmail")}</span></p>
          </div>

          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />} {t("pending.checkNow")}
          </button>
          {checkedAt && !checking && <p role="status" className="mt-2 text-center text-sm text-muted-foreground">{t("pending.stillReview", { time: checkedAt.toLocaleTimeString(i18n.language === "ms" ? "ms-MY" : "en-MY", { hour: "numeric", minute: "2-digit" }) })}</p>}

          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold text-foreground hover:bg-muted"
          >
            <LogOut className="h-5 w-5" /> {t("pending.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
