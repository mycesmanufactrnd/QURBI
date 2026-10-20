import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, Landmark, Loader2, LogOut, MapPin, Star, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, ErrorNotice, ListSkeleton, PageHeader, StatusBadge } from "@/components/ui-kit";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { courierApi } from "@/api/apiClient";
import { errorText } from "@/lib/format";
import { MALAYSIAN_STATES } from "@/lib/states";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const VEHICLES = ["motorcycle", "car", "pickup", "van", "lorry"];
const STANDING_TONE = { approved: "success", pending: "warning", rejected: "danger", suspended: "danger", unverified: "muted" };

export default function Profile() {
  const { t } = useTranslation(["profile", "auth", "common"]);
  const { logout, checkUserAuth } = useAuth();
  const [state, setState] = useState({ loading: true, error: "", me: null });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ loading: false, error: "", me: await courierApi.me() });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorText(error, t) }));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const { me } = state;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={t("title", { ns: "profile" })} />
      <ErrorNotice message={state.error} onRetry={load} retryLabel={t("retry", { ns: "common" })} />
      {state.loading && <ListSkeleton />}

      {me && (
        <>
          <Card>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><UserRound className="h-7 w-7" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{me.user?.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">{me.user?.email}</p>
                <p className="truncate text-sm text-muted-foreground">{me.user?.phone}</p>
              </div>
              <StatusBadge tone={STANDING_TONE[me.verificationStatus]}>{t(`standing.${me.verificationStatus}`, { ns: "profile" })}</StatusBadge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
              <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Bike className="h-3.5 w-3.5" aria-hidden="true" />{t("stats.deliveries", { ns: "profile" })}</dt><dd className="text-lg font-extrabold">{me.totalDeliveries}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Star className="h-3.5 w-3.5" aria-hidden="true" />{t("stats.rating", { ns: "profile" })}</dt><dd className="text-lg font-extrabold">{me.ratingCount ? Number(me.ratingAverage).toFixed(1) : <span className="text-sm font-semibold text-muted-foreground">{t("stats.noRating", { ns: "profile" })}</span>}</dd></div>
            </dl>
          </Card>

          {editing ? (
            <EditForm me={me} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); checkUserAuth(); }} />
          ) : (
            <>
              <Card title={t("vehicle", { ns: "profile" })} action={<Truck className="h-5 w-5 text-primary" aria-hidden="true" />}>
                <p className="text-sm font-bold">{t(`register.vehicles.${me.vehicleType}`, { ns: "auth", defaultValue: me.vehicleType })} · {me.vehiclePlate}</p>
              </Card>
              <Card title={t("serviceArea", { ns: "profile" })} action={<MapPin className="h-5 w-5 text-primary" aria-hidden="true" />}>
                <p className="text-sm font-bold">{me.serviceAreas.map((area) => area.state).join(", ")}</p>
              </Card>
              <Card title={t("bank", { ns: "profile" })} action={<Landmark className="h-5 w-5 text-primary" aria-hidden="true" />}>
                {me.bankAccountNo ? (
                  <div className="text-sm"><p className="font-bold">{me.bankName}</p><p className="text-muted-foreground">{me.bankAccountNo} · {me.bankAccountHolder}</p></div>
                ) : <p className="text-sm text-muted-foreground">{t("noBank", { ns: "profile" })}</p>}
              </Card>
              <Button variant="outline" className="h-12 w-full" onClick={() => setEditing(true)}>{t("edit", { ns: "profile" })}</Button>
            </>
          )}
        </>
      )}

      <Card title={t("language", { ns: "profile" })}><LanguageSwitcher /></Card>
      <Button variant="outline" className="h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => logout()}>
        <LogOut className="h-4 w-4" />{t("logOut", { ns: "common" })}
      </Button>
    </div>
  );
}

function EditForm({ me, onCancel, onSaved }) {
  const { t } = useTranslation(["profile", "auth", "common"]);
  const [form, setForm] = useState({
    vehicleType: me.vehicleType,
    vehiclePlate: me.vehiclePlate,
    bankName: me.bankName || "",
    bankAccountNo: me.bankAccountNo || "",
    bankAccountHolder: me.bankAccountHolder || "",
  });
  const [states, setStates] = useState(me.serviceAreas.map((area) => area.state));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const toggle = (name) => setStates((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  const save = async (event) => {
    event.preventDefault();
    if (!states.length) { setError(t("stateRequired", { ns: "profile" })); return; }
    setBusy(true);
    setError("");
    try {
      await courierApi.updateProfile({
        vehicleType: form.vehicleType,
        vehiclePlate: form.vehiclePlate.trim(),
        serviceAreas: states.map((state) => ({ state })),
        bankName: form.bankName.trim(),
        bankAccountNo: form.bankAccountNo.trim(),
        bankAccountHolder: form.bankAccountHolder.trim(),
      });
      await onSaved();
    } catch (err) {
      setError(errorText(err, t) || t("saveFailed", { ns: "profile" }));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <ErrorNotice message={error} />
      <Card title={t("vehicle", { ns: "profile" })}>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="vehicleType">{t("register.vehicleType", { ns: "auth" })}</Label>
            <select id="vehicleType" value={form.vehicleType} onChange={update("vehicleType")} className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {VEHICLES.map((type) => <option key={type} value={type}>{t(`register.vehicles.${type}`, { ns: "auth" })}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehiclePlate">{t("register.vehiclePlate", { ns: "auth" })}</Label>
            <Input id="vehiclePlate" className="h-12 uppercase" value={form.vehiclePlate} onChange={update("vehiclePlate")} maxLength={20} required />
          </div>
        </div>
      </Card>
      <Card title={t("serviceArea", { ns: "profile" })}>
        <div className="flex flex-wrap gap-2">
          {MALAYSIAN_STATES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={states.includes(name)}
              onClick={() => toggle(name)}
              className={cn("min-h-11 rounded-full px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", states.includes(name) ? "brand-gradient text-primary-foreground shadow-sm" : "bg-card text-foreground/80 ring-1 ring-border hover:bg-secondary/45")}
            >
              {name}
            </button>
          ))}
        </div>
      </Card>
      <Card title={t("bank", { ns: "profile" })}>
        <div className="space-y-3">
          <div className="space-y-2"><Label htmlFor="bankName">{t("register.bankName", { ns: "auth" })}</Label><Input id="bankName" className="h-12" value={form.bankName} onChange={update("bankName")} maxLength={100} /></div>
          <div className="space-y-2"><Label htmlFor="bankAccountNo">{t("register.bankAccountNo", { ns: "auth" })}</Label><Input id="bankAccountNo" className="h-12" inputMode="numeric" value={form.bankAccountNo} onChange={update("bankAccountNo")} maxLength={50} /></div>
          <div className="space-y-2"><Label htmlFor="bankAccountHolder">{t("register.bankAccountHolder", { ns: "auth" })}</Label><Input id="bankAccountHolder" className="h-12" value={form.bankAccountHolder} onChange={update("bankAccountHolder")} maxLength={150} /></div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onCancel} disabled={busy}>{t("cancel", { ns: "common" })}</Button>
        <Button type="submit" className="h-12" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />{t("saving", { ns: "common" })}</> : t("save", { ns: "common" })}</Button>
      </div>
    </form>
  );
}
