import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/agri/BrandLogo";
import { useAuth } from "@/lib/AuthContext";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      navigate(safeReturnTo(), { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-brand-hero min-h-dvh">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="animate-fade-in flex items-center justify-between"><BrandLogo light className="" /><span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 ring-1 ring-white/15 backdrop-blur sm:inline-flex">Farmer portal</span></header>
        <main className="grid flex-1 content-start items-center gap-6 pb-8 pt-10 sm:-translate-y-4 sm:content-center sm:py-8 lg:translate-y-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,.75fr)] lg:gap-16 lg:py-14">
          <section className="animate-fade-in max-w-xl text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/95 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-secondary-foreground shadow-sm"><ShieldCheck className="h-4 w-4" /> Verified livestock marketplace</span>
            <h1 className="mt-5 text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">Your farm, ready for a wider market.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base sm:leading-7">Manage livestock, fulfil buyer orders and grow your farm from one secure place.</p>
          </section>
          <section className="animate-slide-up rounded-[2rem] border border-white/35 bg-card/95 p-5 shadow-[0_24px_70px_rgba(35,28,23,0.32)] backdrop-blur-xl sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <p className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">Welcome back</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Sign in to your registered QURBI Farmer account.</p>
            {error && <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <PortalField label="Email" icon={Mail}><input className="h-12 w-full rounded-2xl border border-border bg-white pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></PortalField>
              <PortalField label="Password" icon={Lock}><input className="h-12 w-full rounded-2xl border border-border bg-white pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></PortalField>
              <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70">
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}{loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="mt-5 text-center text-xs text-muted-foreground">New farmer? <Link to="/register" className="font-bold text-primary hover:underline">Create an account</Link></p>
          </section>
        </main>
        <footer className="text-center text-[10px] leading-relaxed text-white/60 sm:text-left">By continuing you agree to the QURBI Farmer Terms &amp; Privacy Policy.</footer>
      </div>
    </div>
  );
}

function PortalField({ label, icon: Icon, children }) {
  return <label className="block text-sm font-semibold text-foreground">{label}<span className="relative mt-1.5 block"><Icon className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{children}</span></label>;
}
