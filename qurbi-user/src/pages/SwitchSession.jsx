import React, { useEffect, useState } from "react";
import { setSessionTokens } from "@/api/apiClient";

// Receives a session handed over from the farmer portal (see portalSwitch.js
// there). Tokens arrive in the URL fragment, never in a query string.
export default function SwitchSession() {
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
        ? <p className="text-sm">This switch link is invalid. <a className="font-bold underline" href="/auth?mode=login">Log in</a></p>
        : <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E3C19F] border-t-[#41362D]" />}
    </div>
  );
}
