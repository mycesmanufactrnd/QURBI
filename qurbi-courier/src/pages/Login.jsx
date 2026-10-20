import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BrandLogo from "@/components/BrandLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const returnTo = safeReturnTo();
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login({ email: form.email.trim(), password: form.password });
      // A full load, like the other QURBI apps: the profile (and with it the
      // approval state that decides which screen comes next) is fetched fresh.
      window.location.assign(returnTo || "/");
    } catch (authError) {
      setError(authError?.message || t("login.signInFailed"));
      setLoading(false);
    }
  };

  return (
    <div className="home-brand-hero min-h-dvh">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="animate-fade-in flex items-center justify-between">
          <BrandLogo light />
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/75 ring-1 ring-white/15 backdrop-blur sm:inline-flex">{t("login.portalBadge")}</span>
          </div>
        </header>

        <main className="grid flex-1 content-start items-center gap-8 pb-8 pt-10 sm:content-center lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,.75fr)] lg:gap-16">
          <section className="animate-fade-in max-w-xl text-white">
            <h1 className="text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">{t("login.heroTitle")}</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base sm:leading-7">{t("login.heroSubtitle")}</p>
          </section>

          <section className="animate-slide-up rounded-[2rem] border border-white/35 bg-card/95 p-5 shadow-[0_24px_70px_rgba(35,28,23,0.32)] backdrop-blur-xl sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary"><Bike className="h-5 w-5" aria-hidden="true" /></div>
            <p className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">{t("login.welcomeBack")}</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t("login.welcomeSubtitle")}</p>
            {error && <div role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="email" className="h-12 pl-10" type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t("login.newHere")}{" "}
              <Link to="/register" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">{t("login.createAccount")}</Link>
            </p>
            <div className="mt-2 flex items-start gap-2.5 rounded-2xl bg-muted/65 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{t("login.secureNote")}</span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
