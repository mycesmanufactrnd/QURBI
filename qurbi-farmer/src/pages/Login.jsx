import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/components/agri/BrandLogo";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { t } = useTranslation("auth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnTo();
  const { login, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleEmail = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login({ email: form.email.trim(), password: form.password });
      window.location.assign(returnTo || "/");
    } catch (authError) {
      setError(authError?.message || t("login.signInFailed"));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      window.location.assign(returnTo || "/");
    } catch (authError) {
      setError(authError?.message || t("login.googleFailed"));
      setLoading(false);
    }
  };

  return (
    <div className="home-brand-hero min-h-dvh">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="animate-fade-in flex items-center justify-between">
          <BrandLogo light />
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/75 ring-1 ring-white/15 backdrop-blur sm:inline-flex">{t("login.portalBadge")}</span>
          </div>
        </header>

        <main className="grid flex-1 content-start items-center gap-6 pb-8 pt-10 sm:-translate-y-4 sm:content-center sm:py-8 lg:translate-y-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,.75fr)] lg:gap-16 lg:py-14">
          <section className="animate-fade-in max-w-xl text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/95 px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-secondary-foreground shadow-sm">
              <ShieldCheck className="h-4 w-4" /> {t("login.verifiedMarketplace")}
            </span>
            <h1 className="mt-5 text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">
              {t("login.heroTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
              {t("login.heroSubtitle")}
            </p>
            <div className="mt-7 hidden grid-cols-3 gap-3 sm:grid">
              <LoginBenefit value={t("login.benefitList")} label={t("login.benefitListLabel")} />
              <LoginBenefit value={t("login.benefitTrack")} label={t("login.benefitTrackLabel")} />
              <LoginBenefit value={t("login.benefitGrow")} label={t("login.benefitGrowLabel")} />
            </div>
          </section>

          <section className="animate-slide-up rounded-[2rem] border border-white/35 bg-card/95 p-5 shadow-[0_24px_70px_rgba(35,28,23,0.32)] backdrop-blur-xl sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <p className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">{t("login.welcomeBack")}</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t("login.welcomeSubtitle")}</p>
            {error && <div role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <form onSubmit={handleEmail} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" className="h-12 pl-10" type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" className="h-12 pl-10" type="password" value={form.password} onChange={update("password")} autoComplete="current-password" required />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !form.email || !form.password}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {loading ? t("login.signingIn") : t("login.signIn")}
              </button>
            </form>
            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.or")}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 font-bold text-foreground shadow-[0_4px_14px_rgba(65,54,45,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <GoogleIcon className="h-5 w-5" />}
              {loading ? t("login.signingIn") : t("login.continueGoogle")}
            </button>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t("login.newToQurbi")}{" "}
              <Link to="/register" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">{t("login.createAccount")}</Link>
            </p>
            <div className="mt-2 flex items-start gap-2.5 rounded-2xl bg-muted/65 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t("login.secureNote")}</span>
            </div>
          </section>
        </main>

        <footer className="text-center text-sm leading-relaxed text-white/80 sm:text-left">{t("login.terms")}</footer>
      </div>
    </div>
  );
}

function LoginBenefit({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/10 px-4 py-3 backdrop-blur-sm">
      <strong className="block text-sm font-extrabold text-white">{value}</strong>
      <span className="mt-0.5 block text-xs text-white/75">{label}</span>
    </div>
  );
}
