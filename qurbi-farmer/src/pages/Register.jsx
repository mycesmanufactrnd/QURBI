import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, Mail, Phone, User, UserPlus } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";

export default function Register() {
  const { t } = useTranslation("auth");
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      await register({ fullName: form.fullName, email: form.email, phone: form.phone || undefined, password: form.password });
      navigate("/verify", { replace: true });
    } catch (err) {
      setError(err.message || t("register.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={UserPlus} title={t("register.title")} subtitle={t("register.subtitle")} footer={<>{t("register.alreadyRegistered")} <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-secondary underline underline-offset-4">{t("register.logIn")}</Link></>}>
      {error && <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="fullName" label={t("register.fullName")} icon={User}><Input id="fullName" className="h-12 pl-10" value={form.fullName} onChange={update("fullName")} autoComplete="name" minLength={2} maxLength={150} required /></Field>
        <Field id="email" label={t("register.email")} icon={Mail}><Input id="email" className="h-12 pl-10" type="email" value={form.email} onChange={update("email")} autoComplete="email" required /></Field>
        <Field id="phone" label={t("register.phone")} icon={Phone}><Input id="phone" className="h-12 pl-10" type="tel" inputMode="tel" value={form.phone} onChange={update("phone")} autoComplete="tel" maxLength={30} /></Field>
        <Field id="password" label={t("register.password")} icon={Lock} hint={t("register.passwordHint")}><Input id="password" className="h-12 pl-10" type="password" value={form.password} onChange={update("password")} autoComplete="new-password" minLength={8} required aria-describedby="password-hint" /></Field>
        <Field id="confirmPassword" label={t("register.confirmPassword")} icon={Lock}><Input id="confirmPassword" className="h-12 pl-10" type="password" value={form.confirmPassword} onChange={update("confirmPassword")} autoComplete="new-password" minLength={8} required /></Field>
        <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("register.creating")}</> : t("register.createAccount")}</Button>
      </form>
    </AuthLayout>
  );
}

/**
 * @param {{ id: string, label: React.ReactNode, icon: React.ElementType, hint?: React.ReactNode, children?: React.ReactNode }} props
 */
function Field({ id, label, icon: Icon, hint, children }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="relative"><Icon className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{children}</div>{hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}</div>;
}
