import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/**
 * Returns a function that checks authentication before performing an action.
 * If the user is not authenticated, it redirects to /login with a returnTo
 * param and returns false. Otherwise returns true.
 */
export function useRequireAuth() {
  const { isAuthenticated, authChecked, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  return (onAuthed) => {
    // Still resolving auth state — ignore the tap to avoid a false redirect
    if (isLoadingAuth || !authChecked) return false;
    if (isAuthenticated) {
      onAuthed?.();
      return true;
    }
    const returnTo = window.location.pathname + window.location.search;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return false;
  };
}