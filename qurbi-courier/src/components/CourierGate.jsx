import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { FullPageSpinner } from "@/components/ui-kit";

// Where each verification state belongs. The backend blocks every job route
// until the courier is approved; this just sends people to the right screen
// instead of showing them errors.
const HOME_FOR_STATUS = {
  approved: null,
  pending: "/pending",
  rejected: "/rejected",
  suspended: "/suspended",
  unverified: "/verify",
};

export const courierStatus = (user) => user?.courierProfile?.verificationStatus || "unverified";

// `null` means "approved: no redirect", so this must be a key check, not `??`
// (which would treat null as missing and bounce approved couriers to /verify).
export function destinationFor(status) {
  return status in HOME_FOR_STATUS ? HOME_FOR_STATUS[status] : "/verify";
}

export default function CourierGate() {
  const { t } = useTranslation("common");
  const { user, isLoadingAuth } = useAuth();
  if (isLoadingAuth || !user) return <FullPageSpinner label={t("loading")} />;
  const target = destinationFor(courierStatus(user));
  return target ? <Navigate to={target} replace /> : <Outlet />;
}

/**
 * The pre-approval screens (/verify, /pending, ...) must not be reachable once
 * the courier is in a different state, e.g. an approved courier opening /verify.
 * @param {{ allow: string[] }} props
 */
export function StatusScreen({ allow, children }) {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation("common");
  if (isLoadingAuth || !user) return <FullPageSpinner label={t("loading")} />;
  const status = courierStatus(user);
  if (allow.includes(status)) return children;
  return <Navigate to={destinationFor(status) ?? "/"} replace />;
}
