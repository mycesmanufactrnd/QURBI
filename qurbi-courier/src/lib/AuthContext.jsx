import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  authApi,
  AUTH_EXPIRED_EVENT,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/api/apiClient";
import i18n from "@/i18n";

const AuthContext = createContext(null);

// A courier account is single-role, so anything else signing in here is in the
// wrong app. Rejecting it client-side is a courtesy; the backend enforces the
// role on every courier endpoint regardless.
const isCourier = (user) => user?.role === "courier";

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
    if (!session?.accessToken || !isCourier(session.user)) {
      clearAuth();
      // The session was already issued server-side; end it so this
      // wrong-portal login does not leave a live refresh token behind.
      if (session?.refreshToken) authApi.logout(session.refreshToken).catch(() => {});
      throw new Error(i18n.t("errors.notCourier", { ns: "common" }));
    }
    setSessionTokens(session);
    setUser(session.user);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return session.user;
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
      if (!isCourier(currentUser)) throw new Error(i18n.t("errors.notCourier", { ns: "common" }));
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      return currentUser;
    } catch (error) {
      // A phone that is simply offline must not be signed out.
      if (error.isNetworkError) {
        setAuthError({ type: "network", message: error.message });
        return null;
      }
      clearAuth();
      setAuthError({ type: "auth_required", message: error.message || i18n.t("errors.authRequired", { ns: "common" }) });
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [clearAuth]);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearAuth();
      setAuthError({ type: "auth_required", message: i18n.t("errors.sessionExpired", { ns: "common" }) });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, [clearAuth]);

  const login = useCallback(async (credentials) => acceptSession(await authApi.login(credentials)), [acceptSession]);

  const logout = useCallback((shouldRedirect = true) => {
    const refreshToken = getRefreshToken();
    if (refreshToken) authApi.logout(refreshToken).catch(() => {});
    clearAuth();
    setAuthError(null);
    setAuthChecked(true);
    if (shouldRedirect) window.location.assign("/login");
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,
      login,
      logout,
      checkUserAuth,
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
