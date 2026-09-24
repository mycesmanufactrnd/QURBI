import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  authApi,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/api/apiClient";
import { signInWithPopup, signOut } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase";

const AuthContext = createContext(null);
const ALLOWED_ROLES = new Set(["farmer", "admin"]);

function normalizeUser(user) {
  if (!user) return null;
  const verificationStatus = {
    unverified: "Not Submitted",
    pending: "Pending",
    verified: "Approved",
    rejected: "Rejected",
  }[user.farmerProfile?.verificationStatus] || "Not Submitted";
  return {
    ...user,
    full_name: user.fullName,
    display_name: user.fullName,
    data: { ...(user.data || {}), name: user.fullName, verificationStatus },
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const clearAuth = useCallback(() => {
    clearSessionTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const acceptSession = useCallback((session) => {
    if (!session?.accessToken || !ALLOWED_ROLES.has(session.user?.role)) {
      clearAuth();
      throw new Error("This account does not have access to the QURBI Farmer portal.");
    }
    setSessionTokens(session);
    setUser(normalizeUser(session.user));
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return session.user;
  }, [clearAuth]);

  const checkUserAuth = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      clearAuth();
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }

    setIsLoadingAuth(true);
    try {
      const currentUser = await authApi.me();
      if (!ALLOWED_ROLES.has(currentUser?.role)) {
        throw new Error("This account does not have access to the QURBI Farmer portal.");
      }
      setUser(normalizeUser(currentUser));
      setIsAuthenticated(true);
      setAuthError(null);
      return currentUser;
    } catch (error) {
      clearAuth();
      setAuthError({ type: "auth_required", message: error.message || "Authentication required" });
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [clearAuth]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (credentials) => {
    const session = await authApi.login(credentials);
    return acceptSession(session);
  }, [acceptSession]);

  const register = useCallback(async (details) => {
    const credentials = { email: details.email, password: details.password };
    await authApi.register({ ...details, role: "farmer" });
    const session = await authApi.login(credentials);
    return acceptSession(session);
  }, [acceptSession]);

  const loginWithGoogle = useCallback(async () => {
    const credential = await signInWithPopup(firebaseAuth, googleProvider);
    try {
      const idToken = await credential.user.getIdToken();
      const session = await authApi.firebase(idToken);
      return acceptSession(session);
    } catch (error) {
      await signOut(firebaseAuth).catch(() => {});
      throw error;
    }
  }, [acceptSession]);

  const logout = useCallback((shouldRedirect = true) => {
    const refreshToken = getRefreshToken();
    if (refreshToken) authApi.logout(refreshToken).catch(() => {});
    signOut(firebaseAuth).catch(() => {});
    clearAuth();
    setAuthError(null);
    setAuthChecked(true);
    if (shouldRedirect) window.location.assign("/login");
  }, [clearAuth]);

  const navigateToLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      login,
      loginWithGoogle,
      register,
      logout,
      navigateToLogin,
      checkUserAuth,
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
