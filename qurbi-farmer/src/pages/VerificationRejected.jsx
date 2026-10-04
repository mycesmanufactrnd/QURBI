import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { qurbi } from "@/api/qurbiClient";
import BrandLogo from "@/components/agri/BrandLogo";
import StatusBadge from "@/components/agri/StatusBadge";
import { AlertCircle, ArrowRight, LogOut, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const FIX_STEPS = ["read", "tap", "change", "sign"];

export default function VerificationRejected() {
  const { t } = useTranslation("verification");
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const status = user?.data?.verificationStatus || user?.verificationStatus;
  const [reapplying, setReapplying] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reasonLoading, setReasonLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.id) return;
    qurbi.entities.FarmVerification.filter({ userId: user.id }, "-created_date", 1)
      .then((rows) => setReason(rows?.[0]?.rejectionReason || ""))
      .catch(() => setReason(""))
      .finally(() => setReasonLoading(false));
  }, [user?.id]);

  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  if (status === "Not Submitted") return <Navigate to="/verify" replace />;

  const reapply = () => {
    setReapplying(true);
    navigate("/verify?resubmit=1");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-destructive/5 to-background flex flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="flex justify-center"><BrandLogo /></div>

        <div className="flex flex-1 flex-col justify-center animate-fade-in">
          <div className="mt-6 text-center">
            <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 text-red-600">
              <XCircle className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{t("rejected.title")}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("rejected.intro")}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">{t("rejected.status")}</span>
              <StatusBadge kind="verification" status="Rejected" dot>{t("rejected.notApproved")}</StatusBadge>
            </div>
            <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertCircle className="h-4 w-4" />{t("rejected.adminNote")}</p>
              <p className="mt-1.5 text-base leading-relaxed text-foreground">
                {reasonLoading ? t("rejected.loadingNote") : reason || t("rejected.noReason")}
              </p>
            </div>
            <p className="mt-5 text-sm font-bold">{t("rejected.howToFix")}</p>
            <ol className="mt-2 space-y-2">
              {FIX_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-snug text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">{index + 1}</span>
                  <span className="pt-0.5">{t(`rejected.fixSteps.${step}`)}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={reapply}
            disabled={reapplying}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          >
            {reapplying ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {t("rejected.resubmit")} <ArrowRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold text-foreground hover:bg-muted"
          >
            <LogOut className="h-5 w-5" /> {t("rejected.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
