import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { safeReturnTo } from "@/lib/authReturnTo";

const AUTH_ENTRY_PATHS = new Set(["/auth", "/login", "/register"]);

function currentDestination(location) {
  const destination = `${location.pathname}${location.search}${location.hash}`;
  if (AUTH_ENTRY_PATHS.has(location.pathname)) return safeReturnTo();
  return destination.startsWith("/user-agreement") ? "/" : destination;
}

/**
 * Keeps authenticated accounts inside the mandatory agreement flow until the
 * backend-confirmed user record contains both acceptance timestamps.
 */
export default function AgreementGate({ children }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  // Until /auth/me finishes, the backend-backed agreement state is unknown.
  // Existing page-level authentication guards remain responsible for private
  // data during this short session check.
  if (!authChecked || isLoadingAuth || !isAuthenticated) return children;

  const hasAcceptedRequiredPolicies = Boolean(
    user?.privacyPolicyAcceptedAt && user?.userAgreementAcceptedAt,
  );

  if (hasAcceptedRequiredPolicies || location.pathname === "/user-agreement") {
    return children;
  }

  const returnTo = currentDestination(location);
  return (
    <Navigate
      to={`/user-agreement?returnTo=${encodeURIComponent(returnTo)}`}
      replace
    />
  );
}
