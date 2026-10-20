import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Building2, HandHelping, Loader2, MapPin, Phone, ShieldCheck } from "lucide-react";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { getDraft, setDraft } from "@/lib/livestockDraft";
import { MALAYSIA_STATES } from "@/lib/agri";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import FormField, { scrollToField } from "@/components/agri/FormField";
import StickyActionBar from "@/components/agri/StickyActionBar";

export default function RegistrationAssistance() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("livestock");
  const [source, setSource] = useState(location.state?.draft || (!id ? getDraft() : null));
  const [loading, setLoading] = useState(Boolean(id && !location.state?.draft));
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (source || !id) return;
    qurbi.entities.Livestock.get(id)
      .then(setSource)
      .catch(() => navigate(`/livestock/${id}`, { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate, source]);

  useEffect(() => {
    if (!source) {
      if (!id) navigate("/livestock/add", { replace: true });
      return;
    }
    const assistance = source.marketplaceCompliance?.assistance || {};
    setForm({
      contactName: assistance.contactName || user?.full_name || user?.name || "",
      phone: assistance.phone || user?.phone || "",
      identityOrCompanyNumber: assistance.identityOrCompanyNumber || "",
      premiseId: assistance.premiseId || "",
      farmAddress: assistance.farmAddress || "",
      state: assistance.state || source.state || source.farmLocation || "",
      animalCount: assistance.animalCount || 1,
      notes: assistance.notes || "",
    });
  }, [source, user, id, navigate]);

  if (loading || !form) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  const missing = [
    !form.contactName.trim() && { id: "contactName", message: t("registrationAssistance.errors.contactName") },
    !form.phone.trim() && { id: "phone", message: t("registrationAssistance.errors.phone") },
    !form.identityOrCompanyNumber.trim() && { id: "identity", message: t("registrationAssistance.errors.identity") },
    !form.farmAddress.trim() && { id: "farmAddress", message: t("registrationAssistance.errors.address") },
    !form.state && { id: "assistanceState", message: t("registrationAssistance.errors.state") },
    Number(form.animalCount) < 1 && { id: "animalCount", message: t("registrationAssistance.errors.count") },
  ].filter(Boolean);
  const errorFor = (id) => attempted ? missing.find((item) => item.id === id)?.message : undefined;
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const returnPath = id ? `/livestock/${id}/edit` : "/livestock/add";
  const goBack = () => {
    if (id) navigate(returnPath, { state: { registrationDraft: source } });
    else navigate(returnPath);
  };

  const save = () => {
    if (missing.length) {
      setAttempted(true);
      scrollToField(missing.map((item) => item.id));
      return;
    }
    const assistance = {
      ...(source.marketplaceCompliance?.assistance || {}),
      ...form,
      animalCount: Number(form.animalCount),
      requested: true,
      status: source.marketplaceCompliance?.assistance?.status || "pending",
    };
    const updated = {
      ...source,
      requestRegistrationAssistance: true,
      assistanceContactName: assistance.contactName,
      assistancePhone: assistance.phone,
      assistanceIdentityNumber: assistance.identityOrCompanyNumber,
      assistancePremiseId: assistance.premiseId,
      assistanceFarmAddress: assistance.farmAddress,
      assistanceAnimalCount: assistance.animalCount,
      assistanceNotes: assistance.notes,
      marketplaceCompliance: {
        ...(source.marketplaceCompliance || {}),
        assistance,
      },
    };
    if (id) navigate(returnPath, { replace: true, state: { registrationDraft: updated } });
    else {
      setDraft(updated);
      navigate(returnPath, { replace: true });
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in">
      <header className="flex items-center gap-3">
        <button type="button" onClick={goBack} aria-label={t("registrationAssistance.backAria")} className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary/75">{t("registrationAssistance.eyebrow")}</p><h1 className="text-2xl font-extrabold tracking-tight">{t("registrationAssistance.title")}</h1></div>
      </header>

      <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
        <div className="bg-primary p-5 text-primary-foreground">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12"><HandHelping className="h-6 w-6" /></span><div><h2 className="font-extrabold">{t("registrationAssistance.heroTitle")}</h2><p className="mt-1 text-sm leading-5 text-primary-foreground/80">{t("registrationAssistance.heroText")}</p></div></div>
        </div>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="contactName" label={t("form.compliance.contactName")} required error={errorFor("contactName")}><Input value={form.contactName} onChange={(event) => setValue("contactName", event.target.value)} className="h-12" /></FormField>
            <FormField id="phone" label={t("form.compliance.phone")} required error={errorFor("phone")}><div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="tel" value={form.phone} onChange={(event) => setValue("phone", event.target.value)} className="h-12 pl-9" /></div></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="identity" label={t("form.compliance.identityNumber")} required error={errorFor("identity")}><div className="relative"><Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={form.identityOrCompanyNumber} onChange={(event) => setValue("identityOrCompanyNumber", event.target.value)} className="h-12 pl-9" /></div></FormField>
            <FormField label={t("form.compliance.premiseId")} optional hint={t("form.compliance.premiseIdPlaceholder")}><Input value={form.premiseId} onChange={(event) => setValue("premiseId", event.target.value)} className="h-12" /></FormField>
          </div>
          <FormField id="farmAddress" label={t("form.compliance.farmAddress")} required error={errorFor("farmAddress")}><Textarea value={form.farmAddress} onChange={(event) => setValue("farmAddress", event.target.value)} rows={3} className="resize-none text-base" /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="assistanceState" label={t("form.fields.state")} required error={errorFor("assistanceState")}><Select value={form.state} onValueChange={(value) => setValue("state", value)}><SelectTrigger className="h-12"><MapPin className="mr-2 h-4 w-4" /><SelectValue placeholder={t("form.fields.statePlaceholder")} /></SelectTrigger><SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField id="animalCount" label={t("form.compliance.animalCount")} required error={errorFor("animalCount")}><Input type="number" min="1" step="1" value={form.animalCount} onChange={(event) => setValue("animalCount", event.target.value)} className="h-12" /></FormField>
          </div>
          <FormField label={t("form.compliance.notes")} optional><Textarea value={form.notes} onChange={(event) => setValue("notes", event.target.value)} rows={3} placeholder={t("registrationAssistance.notesPlaceholder")} className="resize-none text-base" /></FormField>
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{t("registrationAssistance.notice")}</p>
        </div>
      </section>

      <StickyActionBar hint={missing.length && attempted ? t("registrationAssistance.missing", { count: missing.length }) : t("registrationAssistance.ready")} hintTone={missing.length && attempted ? "danger" : "muted"}>
        <Button type="button" variant="outline" onClick={goBack} className="h-12 w-[34%] rounded-2xl">{t("form.wizard.back")}</Button>
        <Button type="button" onClick={save} className="h-12 flex-1 rounded-2xl font-bold">{t("registrationAssistance.save")}</Button>
      </StickyActionBar>
    </div>
  );
}
