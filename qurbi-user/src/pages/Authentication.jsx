import React, { useState } from "react";
import { Home, LogIn, ShieldCheck, UserPlus, CircleAlert, Mail, Lock, User } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/lib/AuthContext";
import { safeReturnTo } from "@/lib/authReturnTo";
import apiClient from "@/api/apiClient";

const googleButton =
  "flex w-full min-h-[52px] items-center justify-center gap-3 rounded-xl border-2 border-[#41362D] bg-[#FFFFFF] px-4 text-base font-bold text-[#41362D] shadow-sm shadow-black/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9825F] focus-visible:ring-offset-2 active:scale-[0.98]";
const guestButton =
  "flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E3C19F] bg-[#E3C19F]/40 px-4 text-[15px] font-bold text-[#41362D] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9825F] active:scale-[0.98]";

export default function Authentication() {
  const { t } = useTranslation("auth");
  const { t: ta } = useTranslation("account");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithEmail, registerWithEmail, authError, isLoadingAuth } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [formError, setFormError] = useState("");
  const mode = searchParams.get("mode") === "register" ? "register" : "login";
  const isRegister = mode === "register";
  const returnTo = safeReturnTo();

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", nextMode);
    setSearchParams(nextParams);
  };

  const continueAfterSignIn = async (signedInUser) => {
    if (!signedInUser?.privacyPolicyAcceptedAt || !signedInUser?.userAgreementAcceptedAt) {
      navigate(`/user-agreement?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }
    if (!signedInUser?.phone) {
      navigate(`/signup-details?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }
    const { data: savedAddresses } = await apiClient.get("/addresses");
    if (!savedAddresses?.length) {
      navigate(`/address-book?onboarding=1&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }
    navigate(returnTo, { replace: true });
  };

  const handleGoogle = async () => {
    try {
      await continueAfterSignIn(await loginWithGoogle());
    } catch {
      // AuthContext exposes Firebase/backend failures in the existing UI.
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (isRegister && !form.fullName.trim()) {
      setFormError(ta("auth.nameRequired", "Please enter your full name."));
      return;
    }
    if (isRegister && form.password.length < 8) {
      setFormError(ta("auth.passwordTooShort", "Password must be at least 8 characters."));
      return;
    }
    try {
      const signedInUser = isRegister
        ? await registerWithEmail({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password })
        : await loginWithEmail({ email: form.email.trim(), password: form.password });
      await continueAfterSignIn(signedInUser);
    } catch {
      // AuthContext exposes backend failures in the alert above.
    }
  };

  const fieldCls =
    "w-full min-h-12 rounded-xl border-2 border-[#E3C19F] bg-white pl-10 pr-4 py-3 text-base text-[#41362D] placeholder:text-[#6B594A]/60 outline-none focus:border-[#6B594A]";

  const handleContinueHome = () => {
    sessionStorage.removeItem("gh_splash_shown");
    navigate("/");
  };

  const copy = isRegister ? "register" : "login";

  return (
    <AuthLayout
      mode={mode}
      icon={isRegister ? UserPlus : LogIn}
      title={t(`${copy}.title`)}
      subtitle={t(`${copy}.subtitle`)}
      footer={
        <>
          {isRegister ? t("register.haveAccount") : t("login.noAccount")}{" "}
          <button
            type="button"
            onClick={() => changeMode(isRegister ? "login" : "register")}
            className="inline-flex min-h-11 items-center px-1 font-bold text-[#41362D] underline underline-offset-4"
          >
            {isRegister ? t("register.signIn") : t("login.createOne")}
          </button>
        </>
      }
    >
      <div key={mode} className={isRegister ? "auth-mode-content-register" : "auth-mode-content-login"}>
        {authError?.type === "auth_failed" && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#E8A39A] bg-[#FBE4E1] px-3 py-3 text-sm font-semibold text-[#8A1C12]">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>
              <span className="block">{ta("auth.signInFailed")}</span>
              <span className="block font-medium">{authError.message}</span>
            </span>
          </div>
        )}

        <button
          type="button"
          disabled={isLoadingAuth}
          aria-busy={isLoadingAuth}
          onClick={handleGoogle}
          className={`${googleButton} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isLoadingAuth ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#41362D]/30 border-t-[#41362D]" aria-hidden="true" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          {isLoadingAuth
            ? isRegister ? ta("auth.signingUp") : ta("auth.signingIn")
            : isRegister ? t("register.signUpWithGoogle") : t("login.signInWithGoogle")}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-[#5A493C]">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#6B594A]" aria-hidden="true" />
          <span>
            {ta("auth.trustNote")}{" "}
            <Link to="/privacy-policy" className="font-bold text-[#41362D] underline underline-offset-2">
              {ta("auth.privacyLink")}
            </Link>
          </span>
        </p>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#E3C19F]" />
          <span className="text-sm text-[#6B594A]">{ta("auth.orEmail", "or use email")}</span>
          <span className="h-px flex-1 bg-[#E3C19F]" />
        </div>

        <form onSubmit={handleEmailSubmit} noValidate className="space-y-3">
          {formError && (
            <p role="alert" className="rounded-xl bg-[#FBE4E1] px-3 py-2 text-sm font-semibold text-[#8A1C12]">{formError}</p>
          )}
          {isRegister && (
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B594A]" aria-hidden="true" />
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder={ta("auth.fullName", "Full name")}
                aria-label={ta("auth.fullName", "Full name")}
                autoComplete="name"
                maxLength={150}
                className={fieldCls}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B594A]" aria-hidden="true" />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder={ta("auth.email", "Email")}
              aria-label={ta("auth.email", "Email")}
              autoComplete="email"
              required
              className={fieldCls}
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B594A]" aria-hidden="true" />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder={ta("auth.password", "Password")}
              aria-label={ta("auth.password", "Password")}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              className={fieldCls}
            />
          </div>
          <button
            type="submit"
            disabled={isLoadingAuth || !form.email || !form.password}
            className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-4 text-base font-bold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9825F] focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRegister ? ta("auth.signUpWithEmail", "Sign up with email") : ta("auth.signInWithEmail", "Sign in with email")}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#E3C19F]" />
          <span className="text-sm text-[#6B594A]">{t(`${copy}.or`)}</span>
          <span className="h-px flex-1 bg-[#E3C19F]" />
        </div>

        <button
          type="button"
          onClick={handleContinueHome}
          className={guestButton}
        >
          <Home className="h-4 w-4" aria-hidden="true" /> {t(`${copy}.continueToHome`)}
        </button>
        <p className="mt-2 text-center text-[13px] text-[#5A493C]">{ta("auth.guestNote")}</p>
      </div>
    </AuthLayout>
  );
}
