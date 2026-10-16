import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Home, Leaf, LogIn, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import GoogleIcon from "@/components/GoogleIcon";
import apiClient from "@/api/apiClient";
import { useDisplayMode } from "@/lib/display-mode-context";

const AuthPromptContext = createContext(null);
const EXIT_MS = 140;

export function AuthPromptProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDesktop } = useDisplayMode();
  const { authError, isAuthenticated, isLoadingAuth, loginWithGoogle, user } = useAuth();
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeTimer = useRef(null);
  const previousPath = useRef(location.pathname);
  const dragState = useRef(null);

  const dismiss = useCallback(() => {
    setDragging(false);
    setDragOffset(0);
    setVisible(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPrompt(null), EXIT_MS);
  }, []);

  const requestSignIn = useCallback((options = {}) => {
    if (isAuthenticated) {
      options.onAuthenticated?.();
      return;
    }
    window.clearTimeout(closeTimer.current);
    const returnTo =
      options.returnTo ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setPrompt({
      message:
        options.message ||
        "Sign in to continue with this action and access your QURBI account.",
      returnTo,
      onAuthenticated: options.onAuthenticated,
    });
    setDragOffset(0);
    setDragging(false);
    requestAnimationFrame(() => setVisible(true));
  }, [isAuthenticated]);

  const startDrag = (event) => {
    if (!visible || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
    setDragging(true);
  };

  const moveDrag = (event) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - state.lastTime);
    state.velocity = (event.clientY - state.lastY) / elapsed;
    state.lastY = event.clientY;
    state.lastTime = now;
    setDragOffset(Math.max(0, event.clientY - state.startY));
  };

  const finishDrag = (event) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const shouldDismiss =
      dragOffset >= window.innerHeight * 0.1 || state.velocity > 0.55;
    dragState.current = null;
    setDragging(false);
    if (shouldDismiss) dismiss();
    else setDragOffset(0);
  };

  const signInWithGoogle = async () => {
    try {
      const signedInUser = await loginWithGoogle();
      if (!signedInUser?.privacyPolicyAcceptedAt || !signedInUser?.userAgreementAcceptedAt) {
        navigate(`/user-agreement?returnTo=${encodeURIComponent(prompt?.returnTo || "/")}`);
        return;
      }
      if (!signedInUser?.phone) {
        navigate(`/signup-details?returnTo=${encodeURIComponent(prompt?.returnTo || "/")}`);
        return;
      }
      const { data: savedAddresses } = await apiClient.get("/addresses");
      if (!savedAddresses?.length) {
        navigate(`/address-book?onboarding=1&returnTo=${encodeURIComponent(prompt?.returnTo || "/")}`);
      }
    } catch {
      // AuthContext retains the error while the prompt stays open for retry.
    }
  };

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      window.clearTimeout(closeTimer.current);
      setVisible(false);
      setPrompt(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated || !prompt || !user?.phone) return;
    const pendingAction = prompt.onAuthenticated;
    window.clearTimeout(closeTimer.current);
    setVisible(false);
    setPrompt(null);
    pendingAction?.();
  }, [isAuthenticated, prompt, user?.phone]);

  useEffect(
    () => () => window.clearTimeout(closeTimer.current),
    [],
  );

  useEffect(() => {
    if (!prompt || !visible || !isDesktop) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktop, prompt, visible]);

  return (
    <AuthPromptContext.Provider value={{ requestSignIn, dismiss }}>
      {children}
      {prompt &&
        createPortal(
          <div
            className={isDesktop
              ? "fixed inset-0 z-[90] flex items-center justify-center p-5"
              : "pointer-events-none fixed inset-x-0 bottom-0 z-[90] h-[50dvh] ease-out"}
            style={{
              opacity: visible
                ? Math.max(0.65, 1 - dragOffset / window.innerHeight)
                : 0,
              transform: visible
                ? isDesktop ? "scale(1)" : `translateY(${dragOffset}px)`
                : isDesktop ? "scale(0.96)" : "translateY(calc(100% + 7rem))",
              transitionProperty: "transform, opacity",
              transitionDuration: dragging ? "0ms" : isDesktop ? "180ms" : "120ms",
            }}
            role="dialog"
            aria-modal={isDesktop ? "true" : "false"}
            aria-labelledby="auth-prompt-title"
          >
            {isDesktop ? (
              <button
                type="button"
                className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
                aria-label="Close sign-in popup"
                onClick={dismiss}
              />
            ) : null}
            <div
              className={isDesktop
                ? "pointer-events-auto relative z-10 w-full max-w-lg overflow-y-auto rounded-3xl border border-[#F7EDE2]/70 bg-gradient-to-br from-[#41362D] to-[#6B594A] p-6 shadow-[0_24px_70px_rgba(20,16,13,0.45)]"
                : "pointer-events-auto relative mx-auto h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-[#F7EDE2]/70 bg-gradient-to-br from-[#41362D] to-[#6B594A] p-4 shadow-[0_12px_35px_rgba(65,54,45,0.3)]"}
            >
              {isDesktop ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F]"
                  aria-label="Close sign-in popup"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              <div
                onPointerDown={isDesktop ? undefined : startDrag}
                onPointerMove={isDesktop ? undefined : moveDrag}
                onPointerUp={isDesktop ? undefined : finishDrag}
                onPointerCancel={isDesktop ? undefined : finishDrag}
                className={isDesktop ? "select-none" : `touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                aria-label={isDesktop ? undefined : "Drag down to dismiss sign-in panel"}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-md shadow-black/20">
                    <Leaf className="h-4 w-4 text-[#41362D]" />
                  </div>
                  <span className="text-sm font-bold tracking-[0.16em] text-white">
                    QURBI
                  </span>
                </div>

                <div className="mt-3 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-[#F7EDE2]/70 bg-white/10 shadow-lg shadow-black/20">
                    <LogIn className="h-5 w-5 text-[#F7EDE2]" />
                  </div>
                  <p id="auth-prompt-title" className="mt-2 text-sm font-bold text-[#F7EDE2]">
                    Sign in to your account
                  </p>
                  <p className="mt-1 text-xs text-[#F7EDE2]/80">{prompt.message}</p>
                </div>
              </div>

              {authError?.type === "auth_failed" && (
                <p role="alert" className="mt-3 rounded-xl border border-red-200/70 bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                  {authError.message}
                </p>
              )}

              <div className={isDesktop ? "mt-4 grid grid-cols-2 gap-3" : ""}>
                <button
                  type="button"
                  disabled={isLoadingAuth}
                  onClick={signInWithGoogle}
                  className={`${isDesktop ? "" : "mt-3"} flex w-full items-center justify-center gap-2 rounded-xl border border-[#E3C19F] bg-white px-3 py-3.5 text-sm font-bold text-black shadow-sm shadow-black/10 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <GoogleIcon className="h-5 w-5" />
                  {isLoadingAuth ? "Opening Google…" : "Sign in with Google"}
                </button>
                {isDesktop ? (
                  <Link
                    to={`/auth?mode=register${prompt.returnTo && prompt.returnTo !== "/" ? `&returnTo=${encodeURIComponent(prompt.returnTo)}` : ""}`}
                    className="flex w-full items-center justify-center rounded-xl border border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] px-3 py-3.5 text-center text-sm font-bold text-[#41362D] transition-all hover:brightness-105 active:scale-95"
                  >
                    Create account
                  </Link>
                ) : null}
              </div>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#41362D] px-3 text-[#F7EDE2]/70">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#41362D] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] py-3 text-sm font-bold text-[#41362D] transition-all active:scale-95"
              >
                <Home className="h-4 w-4" /> Continue Exploring
              </button>

              {!isDesktop ? <p className="mt-3 text-center text-sm text-[#F7EDE2]">
                Don&apos;t have an account?{" "}
                <Link
                  to={`/auth?mode=register${prompt.returnTo && prompt.returnTo !== "/" ? `&returnTo=${encodeURIComponent(prompt.returnTo)}` : ""}`}
                  className="font-bold text-white hover:underline"
                >
                  Create one
                </Link>
              </p> : null}
            </div>
          </div>,
          document.body,
        )}
    </AuthPromptContext.Provider>
  );
}

export function useAuthPrompt() {
  const context = useContext(AuthPromptContext);
  if (!context) {
    throw new Error("useAuthPrompt must be used within AuthPromptProvider");
  }
  return context;
}
