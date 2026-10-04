import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/AuthContext";
import { qurbi } from "@/api/qurbiClient";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { switchToBuyerPortal } from "@/lib/portalSwitch";
import StatusBadge from "@/components/agri/StatusBadge";
import DeliveryPreference from "@/components/agri/DeliveryPreference";
import { MALAYSIA_STATES, VERIFICATION_STATUSES, initials, userVal } from "@/lib/agri";
import {
  LogOut, ArrowLeftRight, Mail, Phone, Home as HomeIcon, MapPin, Shield, ChevronRight, Pencil, Loader2,
} from "lucide-react";

const EMPTY_FORM = { name: "", phoneNumber: "", farmName: "", address: "", state: "" };

export default function Profile() {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  const { user, logout, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    qurbi.entities.FarmerProfile.filter({ userId: user.id })
      .then((data) => setProfile(data?.[0] || null))
      .catch(() => setProfile(null));
  }, [user?.id]);

  const name = userVal(user, "name") || user?.full_name || t("defaultName");
  const verificationStatus = userVal(user, "verificationStatus");
  const vInfo = VERIFICATION_STATUSES[verificationStatus || "Not Submitted"];
  const toneMap = { success: "success", warning: "warning", danger: "danger", muted: "muted" };

  const openEditor = () => {
    setForm({
      name,
      phoneNumber: user?.phone || "",
      farmName: profile?.farmName || "",
      address: profile?.address || "",
      state: profile?.state || "",
    });
    setSaveError("");
    setEditOpen(true);
  };

  const setField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setSaveError("");
  };

  const formValid = Boolean(
    form.name.trim() && form.phoneNumber.trim() && form.farmName.trim()
    && form.address.trim() && form.state
  );

  const saveProfile = async () => {
    if (!profile?.id || !formValid || saving) return;

    const nextName = form.name.trim();
    const userChanges = {
      fullName: nextName,
      phone: form.phoneNumber.trim(),
    };
    const profileChanges = {
      farmName: form.farmName.trim(),
      address: form.address.trim(),
      state: form.state,
    };

    setSaving(true);
    setSaveError("");
    try {
      await Promise.all([
        apiClient.patch(`/users/${user.id}`, userChanges),
        qurbi.entities.FarmerProfile.update(profile.id, profileChanges),
      ]);
      setProfile((current) => ({ ...current, ...profileChanges }));
      await checkUserAuth();
      setEditOpen(false);
      toast({ title: t("updatedTitle"), description: t("updatedDescription") });
    } catch (error) {
      setSaveError(error?.message || t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const canSwitchToBuyer = user?.availableRoles?.includes("buyer");

  const switchToBuyer = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchToBuyerPortal();
    } catch (error) {
      setSwitching(false);
      toast({ title: t("switchFailedTitle"), description: error?.message || t("tryAgain"), variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <Button type="button" variant="outline" onClick={openEditor} disabled={!profile} className="h-11 rounded-2xl">
          <Pencil className="mr-1.5 h-4 w-4" /> {t("editProfile")}
        </Button>
      </div>

      <section className="home-brand-hero mt-4 rounded-[1.75rem] p-5 text-primary-foreground shadow-[0_8px_24px_rgba(65,54,45,0.18)]">
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/15 text-lg font-extrabold shadow-sm">
            {userVal(user, "profilePhoto") ? <Image src={userVal(user, "profilePhoto")} fittingType="fill" className="h-full w-full" /> : initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/85">{t("farmerAccount")}</p>
            <h2 className="mt-1 truncate text-xl font-extrabold tracking-tight text-white">{name}</h2>
            <p className="mt-0.5 truncate text-sm text-white/90">{user?.email}</p>
          </div>
        </div>
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur-sm">
            <Shield className="h-3.5 w-3.5" /> {t(`common:verification.${verificationStatus || "Not Submitted"}`, { defaultValue: vInfo.label })}
          </span>
        </div>
      </section>

      {verificationStatus !== "Approved" && (
        <div className="soft-card mt-4 flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("verificationStatus")}</p>
            <div className="mt-1"><StatusBadge tone={toneMap[vInfo.tone]} dot>{t(`common:verification.${verificationStatus || "Not Submitted"}`, { defaultValue: vInfo.label })}</StatusBadge></div>
          </div>
          <button type="button" onClick={() => navigate(verificationStatus === "Rejected" ? "/rejected" : verificationStatus === "Pending" ? "/pending" : "/verify")} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary/60">
            {verificationStatus === "Rejected" ? t("seeWhatToFix") : verificationStatus === "Pending" ? t("viewStatus") : t("verifyNow")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="soft-card mt-4 divide-y divide-border/70 overflow-hidden">
        <Row icon={Mail} label={t("rows.email")} value={user?.email} />
        <Row icon={Phone} label={t("rows.phone")} value={user?.phone || "—"} />
        <Row icon={HomeIcon} label={t("rows.farmName")} value={profile?.farmName || "—"} />
        <Row icon={MapPin} label={t("rows.farmAddress")} value={profile?.address || "—"} />
        <Row icon={MapPin} label={t("rows.state")} value={profile?.state || "—"} />
      </div>

      {profile && (
        <div className="mt-4">
          <DeliveryPreference profile={profile} />
        </div>
      )}

      <LanguageSwitcher className="mt-4" />

      {canSwitchToBuyer && (
        <button
          type="button"
          onClick={switchToBuyer}
          disabled={switching}
          className="soft-card mt-4 flex min-h-12 w-full items-center gap-3 p-4 text-left hover:bg-secondary/40 disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/60">
            {switching ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ArrowLeftRight className="h-4 w-4 text-primary" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">{t("switchToBuyer")}</span>
            <span className="block text-sm text-muted-foreground">{t("switchToBuyerHint")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <button
        onClick={() => logout()}
        className="mt-6 w-full h-12 rounded-2xl border border-border bg-card text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/5"
      >
        <LogOut className="w-5 h-5" /> {t("logOut")}
      </button>

      <p className="text-center text-xs text-muted-foreground mt-6">{t("footer")}</p>

      <Dialog open={editOpen} onOpenChange={(open) => !saving && setEditOpen(open)}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground"><span className="font-bold text-destructive">*</span> {t("dialog.requiredNote")}</p>
            <Field label={t("dialog.fullName")} required>
              <Input value={form.name} onChange={setField("name")} autoComplete="name" className="h-11" />
            </Field>
            <Field label={t("dialog.email")}>
              <Input value={user?.email || ""} disabled className="h-11" />
              <p className="text-xs text-muted-foreground">{t("dialog.emailHint")}</p>
            </Field>
            <Field label={t("dialog.phone")} required>
              <Input value={form.phoneNumber} onChange={setField("phoneNumber")} inputMode="tel" autoComplete="tel" className="h-11" />
            </Field>
            <Field label={t("dialog.farmName")} required>
              <Input value={form.farmName} onChange={setField("farmName")} className="h-11" />
            </Field>
            <Field label={t("dialog.farmAddress")} required>
              <Input value={form.address} onChange={setField("address")} autoComplete="street-address" className="h-11" />
            </Field>
            <Field label={t("dialog.state")} required>
              <Select value={form.state} onValueChange={(state) => setForm((current) => ({ ...current, state }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder={t("dialog.selectState")} /></SelectTrigger>
                <SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              {t("dialog.icLocked")}
            </div>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={saveProfile} disabled={!formValid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/60"><Icon className="h-4 w-4 text-primary" /></span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}
