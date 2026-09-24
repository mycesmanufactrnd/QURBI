import React from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";

/**
 * Auth-aware action buttons.
 * - Authenticated: shows a Logout button that SPA-navigates to Home, where the
 *   branded full-page splash plays the logout transition (no reload flash).
 * - Unauthenticated: shows Sign In and Sign Up buttons.
 */
export default function AuthButtons({ returnTo = null }) {
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
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] py-3 text-sm font-bold text-white shadow-md shadow-black/20 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
      >
        <LogOut className="w-4 h-4" /> Log out
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => requestSignIn({ returnTo: target })}
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] py-3 text-sm font-bold text-black transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
      >
        <LogIn className="w-4 h-4" /> Sign In
      </button>
      <button
        onClick={() =>
          navigate(`/auth?mode=register&returnTo=${encodeURIComponent(target)}`)
        }
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] py-3 text-sm font-bold text-white shadow-md shadow-black/20 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
      >
        <UserPlus className="w-4 h-4" /> Sign Up
      </button>
    </div>
  );
}
