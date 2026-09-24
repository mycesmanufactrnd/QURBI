import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";

/**
 * Returns a function that checks authentication before performing an action.
 * If the user is not authenticated, it opens the shared sign-in prompt and
 * returns false. Otherwise returns true.
 */
export function useRequireAuth() {
  const { isAuthenticated, authChecked, isLoadingAuth } = useAuth();
  const { requestSignIn } = useAuthPrompt();

  return (onAuthed) => {
    // Still resolving auth state — ignore the tap to avoid a false redirect
    if (isLoadingAuth || !authChecked) return false;
    if (isAuthenticated) {
      onAuthed?.();
      return true;
    }
    requestSignIn({ onAuthenticated: onAuthed });
    return false;
  };
}
