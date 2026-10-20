import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, CreditCard, Landmark, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { courierApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { MALAYSIAN_STATES } from "@/lib/states";

const VEHICLES = ["motorcycle", "car", "pickup", "van", "lorry"];

export default function Register() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", password: "", confirmPassword: "",
    icNumber: "", vehicleType: "motorcycle", vehiclePlate: "",
    bankName: "", bankAccountNo: "", bankAccountHolder: "",
    acceptTerms: false,
  });
  const [states, setStates] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const toggleState = (name) => setStates((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError(t("register.passwordMismatch")); return; }
    if (!states.length) { setError(t("register.pickState")); return; }
    setLoading(true);
    try {
      await courierApi.register({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        icNumber: form.icNumber.trim(),
        vehicleType: form.vehicleType,
        vehiclePlate: form.vehiclePlate.trim(),
        serviceAreas: states.map((state) => ({ state })),
        ...(form.bankName.trim() ? { bankName: form.bankName.trim() } : {}),
        ...(form.bankAccountNo.trim() ? { bankAccountNo: form.bankAccountNo.trim() } : {}),
        ...(form.bankAccountHolder.trim() ? { bankAccountHolder: form.bankAccountHolder.trim() } : {}),
        acceptTerms: form.acceptTerms,
      });
      await login({ email: form.email.trim(), password: form.password });
      // Next stop is the document upload; /verify sorts out the rest.
      window.location.assign("/verify");
    } catch (err) {
      setError(err.message || t("register.failed"));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Bike}
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      footer={<>{t("register.alreadyRegistered")} <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-secondary underline underline-offset-4">{t("register.logIn")}</Link></>}
    >
      {error && <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-extrabold uppercase tracking-wider text-primary">{t("register.sections.account")}</legend>
          <Field id="fullName" label={t("register.fullName")} icon={User}><Input id="fullName" className="h-12 pl-10" value={form.fullName} onChange={update("fullName")} autoComplete="name" minLength={2} maxLength={150} required /></Field>
          <Field id="email" label={t("register.email")} icon={Mail}><Input id="email" className="h-12 pl-10" type="email" value={form.email} onChange={update("email")} autoComplete="email" required /></Field>
          <Field id="phone" label={t("register.phone")} icon={Phone}><Input id="phone" className="h-12 pl-10" type="tel" inputMode="tel" value={form.phone} onChange={update("phone")} autoComplete="tel" minLength={7} maxLength={30} required /></Field>
          <Field id="password" label={t("register.password")} icon={Lock} hint={t("register.passwordHint")}><Input id="password" className="h-12 pl-10" type="password" value={form.password} onChange={update("password")} autoComplete="new-password" minLength={8} maxLength={72} required aria-describedby="password-hint" /></Field>
          <Field id="confirmPassword" label={t("register.confirmPassword")} icon={Lock}><Input id="confirmPassword" className="h-12 pl-10" type="password" value={form.confirmPassword} onChange={update("confirmPassword")} autoComplete="new-password" minLength={8} required /></Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-extrabold uppercase tracking-wider text-primary">{t("register.sections.vehicle")}</legend>
          <Field id="icNumber" label={t("register.icNumber")} icon={CreditCard} hint={t("register.icHint")}><Input id="icNumber" className="h-12 pl-10" value={form.icNumber} onChange={update("icNumber")} minLength={6} maxLength={30} required aria-describedby="icNumber-hint" /></Field>
          <div className="space-y-2">
            <Label htmlFor="vehicleType">{t("register.vehicleType")}</Label>
            <select id="vehicleType" value={form.vehicleType} onChange={update("vehicleType")} className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {VEHICLES.map((type) => <option key={type} value={type}>{t(`register.vehicles.${type}`)}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehiclePlate">{t("register.vehiclePlate")}</Label>
            <Input id="vehiclePlate" className="h-12 uppercase" value={form.vehiclePlate} onChange={update("vehiclePlate")} maxLength={20} required />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-extrabold uppercase tracking-wider text-primary">{t("register.sections.area")}</legend>
          <p className="text-sm text-muted-foreground">{t("register.areaHint")}</p>
          <div className="flex flex-wrap gap-2">
            {MALAYSIAN_STATES.map((name) => {
              const selected = states.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleState(name)}
                  className={cn(
                    "min-h-11 rounded-full px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "brand-gradient text-primary-foreground shadow-sm" : "bg-card text-foreground/80 ring-1 ring-border hover:bg-secondary/45",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-extrabold uppercase tracking-wider text-primary">{t("register.sections.bank")}</legend>
          <p className="text-sm text-muted-foreground">{t("register.bankHint")}</p>
          <Field id="bankName" label={t("register.bankName")} icon={Landmark}><Input id="bankName" className="h-12 pl-10" value={form.bankName} onChange={update("bankName")} maxLength={100} /></Field>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNo">{t("register.bankAccountNo")}</Label>
            <Input id="bankAccountNo" className="h-12" inputMode="numeric" value={form.bankAccountNo} onChange={update("bankAccountNo")} maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountHolder">{t("register.bankAccountHolder")}</Label>
            <Input id="bankAccountHolder" className="h-12" value={form.bankAccountHolder} onChange={update("bankAccountHolder")} maxLength={150} />
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.035] p-3">
          <Checkbox checked={form.acceptTerms} onCheckedChange={(checked) => setForm((current) => ({ ...current, acceptTerms: checked === true }))} className="mt-0.5" />
          <span className="text-sm leading-relaxed">{t("register.terms")}</span>
        </label>

        <Button type="submit" className="h-12 w-full font-medium" disabled={loading || !form.acceptTerms}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("register.creating")}</> : t("register.createAccount")}
        </Button>
      </form>
    </AuthLayout>
  );
}

/** @param {{ id: string, label: React.ReactNode, icon: React.ElementType, hint?: React.ReactNode, children?: React.ReactNode }} props */
function Field({ id, label, icon: Icon, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        {children}
      </div>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
