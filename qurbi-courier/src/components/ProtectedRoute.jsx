import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { ErrorNotice, FullPageSpinner } from "@/components/ui-kit";

/** Renders its child routes only for a signed-in courier; otherwise `unauthenticatedElement`. */
export default function ProtectedRoute({ unauthenticatedElement }) {
  const { t } = useTranslation("common");
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) checkUserAuth();
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) return <FullPageSpinner label={t("loading")} />;

  // Offline at startup is not a sign-out: keep the tokens and let them retry.
  if (authError?.type === "network") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center px-5">
        <div className="w-full">
          <ErrorNotice message={t("errors.network")} onRetry={checkUserAuth} retryLabel={t("retry")} />
        </div>
      </div>
    );
  }

  if (authError || !isAuthenticated) return unauthenticatedElement;
  return <Outlet />;
}
