import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";

/**
 * Auth-aware action buttons.
 * - Authenticated: shows a Logout button that SPA-navigates to Home, where the
 *   branded full-page splash plays the logout transition (no reload flash).
 * - Unauthenticated: shows Sign In and Sign Up buttons.
 */
export default function AuthButtons({ returnTo = null, onDark = false, compact = false }) {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, authChecked, softLogout } = useAuth();
  const { requestSignIn } = useAuthPrompt();

  if (isLoadingAuth || !authChecked) return null;

  const target =
    returnTo ||
    (typeof window !== "undefined" ? window.location.pathname : "/");

  const handleLogout = async () => {
    // Clear the splash flag so Home plays the full-page splash on arrival.
    sessionStorage.removeItem("gh_splash_shown");
    // Soft logout: clears token + auth state without an SDK reload/redirect.
    await softLogout();
    // SPA navigate to Home — Home's SplashScreen covers the transition.
    navigate("/");
  };

  if (isAuthenticated) {
    return (
      <button
        onClick={handleLogout}
        aria-label={t("authButtons.logOut")}
        title={compact ? t("authButtons.logOut") : undefined}
        className={`flex min-h-12 w-full items-center justify-center rounded-2xl border-2 bg-transparent text-[15px] font-bold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9825F] ${compact ? "px-0 py-3" : "gap-2 py-3"} ${onDark ? "border-white/40 text-white hover:bg-white/10" : "border-[#6B594A] text-[#41362D] hover:bg-[#41362D]/5"}`}
      >
        <LogOut className="h-4 w-4" />
        {!compact ? <span>{t("authButtons.logOut")}</span> : null}
      </button>
    );
  }

  return (
    <div className={`grid grid-cols-2 ${compact ? "gap-1.5" : "gap-3"}`}>
      <button
        onClick={() => requestSignIn({ returnTo: target })}
        aria-label={t("authButtons.signIn")}
        title={compact ? t("authButtons.signIn") : undefined}
        className={`flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] py-3 text-[15px] font-bold text-[#41362D] transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] ${compact ? "px-0" : "gap-2"}`}
      >
        <LogIn className="h-4 w-4" />
        {!compact ? <span>{t("authButtons.signIn")}</span> : null}
      </button>
      <button
        onClick={() =>
          navigate(`/auth?mode=register&returnTo=${encodeURIComponent(target)}`)
        }
        aria-label={t("authButtons.signUp")}
        title={compact ? t("authButtons.signUp") : undefined}
        className={`flex min-h-12 items-center justify-center rounded-2xl py-3 text-[15px] font-bold text-white transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] ${compact ? "px-0" : "gap-2"} ${onDark ? "border-2 border-white/40 bg-transparent" : "bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-black/20"}`}
      >
        <UserPlus className="h-4 w-4" />
        {!compact ? <span>{t("authButtons.signUp")}</span> : null}
      </button>
    </div>
  );
}
