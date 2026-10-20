import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, Loader2, Pause, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui-kit";
import AuthLayout from "@/components/AuthLayout";
import { courierApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

function useRefresh() {
  const { checkUserAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try { await checkUserAuth(); } finally { setBusy(false); }
  };
  return { busy, refresh };
}

function LogOutLink() {
  const { t } = useTranslation("common");
  const { logout } = useAuth();
  return <button type="button" onClick={() => logout()} className="mt-4 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-muted-foreground underline underline-offset-4">{t("logOut")}</button>;
}

export function Pending() {
  const { t } = useTranslation("verification");
  const { busy, refresh } = useRefresh();
  return (
    <AuthLayout icon={Clock} title={t("pending.title")} subtitle={t("pending.body")}>
      <p className="text-sm font-extrabold uppercase tracking-wider text-primary">{t("pending.stepsTitle")}</p>
      <ol className="mt-3 space-y-3 text-sm">
        {["step1", "step2", "step3"].map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-extrabold text-primary">{index + 1}</span>
            <span className="pt-0.5 leading-6">{t(`pending.${step}`)}</span>
          </li>
        ))}
      </ol>
      <Button className="mt-6 h-12 w-full" variant="outline" onClick={refresh} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("pending.refresh")}
      </Button>
      <LogOutLink />
    </AuthLayout>
  );
}

export function Rejected() {
  const { t } = useTranslation("verification");
  const [reason, setReason] = useState("");
  // The reason lives on the latest verification, which /auth/me does not carry.
  useEffect(() => {
    let active = true;
    courierApi.me().then((me) => { if (active) setReason(me.latestVerification?.rejectionReason || ""); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <AuthLayout icon={XCircle} title={t("rejected.title")} subtitle={t("rejected.body")}>
      {reason && (
        <Card className="border-destructive/30" bodyClassName="bg-destructive/5">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">{t("rejected.reasonLabel")}</p>
          <p className="mt-1 break-words text-sm leading-6">{reason}</p>
        </Card>
      )}
      <Button asChild className="mt-5 h-12 w-full"><Link to="/verify">{t("rejected.resubmit")}</Link></Button>
      <LogOutLink />
    </AuthLayout>
  );
}

export function Suspended() {
  const { t } = useTranslation("verification");
  const { user } = useAuth();
  const { busy, refresh } = useRefresh();
  const reason = user?.courierProfile?.suspensionReason;
  return (
    <AuthLayout icon={Pause} title={t("suspended.title")} subtitle={t("suspended.body")}>
      {reason && (
        <Card className="border-destructive/30" bodyClassName="bg-destructive/5">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">{t("suspended.reasonLabel")}</p>
          <p className="mt-1 break-words text-sm leading-6">{reason}</p>
        </Card>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{t("suspended.contact")}</p>
      <Button className="mt-5 h-12 w-full" variant="outline" onClick={refresh} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("suspended.refresh")}
      </Button>
      <LogOutLink />
    </AuthLayout>
  );
}
