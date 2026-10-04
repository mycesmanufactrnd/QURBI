import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setSessionTokens } from "@/api/apiClient";

// Receives a session handed over from the buyer portal (see portalSwitch.js).
export default function SwitchSession() {
  const { t } = useTranslation("auth");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const next = params.get("next") || "/";
    if (!accessToken || !refreshToken) {
      setFailed(true);
      return;
    }
    setSessionTokens({ accessToken, refreshToken });
    // Full reload so the auth provider re-reads the stored session; only
    // same-site relative paths are followed.
    window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 text-center">
      {failed
        ? <p className="text-sm text-muted-foreground">{t("switchSession.invalid")} <a className="font-semibold underline" href="/login">{t("switchSession.logIn")}</a></p>
        : <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />}
    </div>
  );
}
