import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import {
  authApi,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/api/apiClient";
import { clearSession } from "@/lib/clearSession";
import { firebaseAuth, googleAuthProvider } from "@/lib/firebase";

const AuthContext = createContext(null);
const ALLOWED_ROLES = new Set(["buyer", "farmer"]);

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    full_name: user.fullName ?? user.full_name,
    display_name: user.fullName ?? user.display_name ?? user.full_name,
    data: { ...(user.data || {}), name: user.fullName ?? user.full_name },
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const clearAuth = useCallback(() => {
    clearSession();
    clearSessionTokens();
    try { localStorage.removeItem("qurbi_firebase_user"); } catch {}
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const acceptSession = useCallback((session) => {
    if (!session?.accessToken || !session?.refreshToken || !ALLOWED_ROLES.has(session.user?.role)) {
      clearAuth();
      throw new Error("This account does not have access to the QURBI User portal.");
    }
    setSessionTokens(session);
    const normalized = normalizeUser(session.user);
    setUser(normalized);
    try { localStorage.setItem("qurbi_firebase_user", JSON.stringify(normalized)); } catch {}
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return normalized;
  }, [clearAuth]);

  const checkUserAuth = useCallback(async () => {
    if (!getAccessToken()) {
      clearAuth();
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }
    setIsLoadingAuth(true);
    try {
      const currentUser = await authApi.me();
      if (!ALLOWED_ROLES.has(currentUser?.role)) throw new Error("This account does not have access to the QURBI User portal.");
      const normalized = normalizeUser(currentUser);
      setUser(normalized);
      setIsAuthenticated(true);
      setAuthError(null);
      return normalized;
    } catch (error) {
      clearAuth();
      setAuthError({ type: "auth_required", message: error.message || "Authentication required" });
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [clearAuth]);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const loginWithGoogle = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const credential = await signInWithPopup(firebaseAuth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      return acceptSession(await authApi.firebase(idToken));
    } catch (error) {
      await signOut(firebaseAuth).catch(() => {});
      clearAuth();
      const message = !error.response && error.code === "ERR_NETWORK"
        ? "Cannot reach the QURBI server. Start the local NestJS backend on port 3000 and try again."
        : error.code === "auth/unauthorized-domain"
          ? "Firebase does not allow this address. Open QURBI using http://localhost and add the host to Firebase Authentication's authorized domains."
          : error.code === "auth/popup-blocked"
            ? "The browser blocked the Google sign-in popup. Allow popups for QURBI and try again."
            : error.code === "auth/popup-closed-by-user"
              ? "Google sign-in was cancelled."
              : error.response?.data?.message || error.message || "Google sign-in failed";
      setAuthError({ type: "auth_failed", message });
      throw error;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [acceptSession, clearAuth]);

  const logout = useCallback(async (shouldRedirect = true) => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Always clear both sessions even if revocation cannot reach the API.
    } finally {
      clearAuth();
      setAuthError(null);
      setAuthChecked(true);
      await signOut(firebaseAuth).catch(() => {});
    }
    if (shouldRedirect) window.location.assign("/");
  }, [clearAuth]);

  const navigateToLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings: false,
      authError, appPublicSettings: null, authChecked, loginWithGoogle, logout,
      softLogout: () => logout(false), navigateToLogin, checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
