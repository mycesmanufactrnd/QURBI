import React, { useEffect, useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { farmerProfileApi, farmVerificationApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Loader2, UserCheck } from "lucide-react";
import BrandLogo from "@/components/agri/BrandLogo";
import DeliveryMethodCards from "@/components/agri/DeliveryMethodCards";
import DocUploader from "@/components/agri/DocUploader";
import FormField, { scrollToField } from "@/components/agri/FormField";
import StepIndicator from "@/components/agri/StepIndicator";
import StickyActionBar from "@/components/agri/StickyActionBar";
import { MALAYSIA_STATES, userVal } from "@/lib/agri";
import { getFarmerVerificationDraft, saveFarmerVerificationDraft } from "@/lib/farmerVerificationDraft";
import { useTranslation } from "react-i18next";


const EMPTY_FORM = {
  name: "", phoneNumber: "", icNumber: "", farmName: "", address: "", city: "", postcode: "", state: "", deliveryPreference: "",
};

export default function FarmerVerification() {
  const { t } = useTranslation("verification");
  const STEPS = [
    { n: 1, label: t("form.steps.farmDetails") },
    { n: 2, label: t("form.steps.policyTerms") },
  ];
  const IC_TIPS = [t("form.docs.tips.corners"), t("form.docs.tips.readable"), t("form.docs.tips.noGlare")];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const savedDraft = getFarmerVerificationDraft();
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: userVal(user, "name") || user?.full_name || "",
    ...(savedDraft?.form || {}),
  }));
  const [docs, setDocs] = useState(() => ({
    icFront: null,
    icBack: null,
    selfieImage: null,
    farmerCertificate: null,
    ...(savedDraft?.docs || {}),
  }));
  const [loading, setLoading] = useState(!savedDraft);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    farmerProfileApi.byUser(user.id)
      .then(async (profile) => {
        const verificationPage = profile
          ? await farmVerificationApi.list({ page: 1, limit: 1 })
          : null;
        const verification = verificationPage?.data?.[0];
        if (verification?.rejectionReason) setRejectionReason(verification.rejectionReason);
        if (savedDraft) return;
        const documents = verification?.documents || {};
        const personalDetails = documents.personalDetails || {};
        if (profile) {
          setForm({
            name: userVal(user, "name") || user?.full_name || "",
            phoneNumber: personalDetails.phoneNumber || "",
            icNumber: personalDetails.icNumber || "",
            farmName: profile.farmName || "",
            address: profile.farmAddressLine || "",
            city: profile.farmCity || "",
            postcode: profile.farmPostcode || "",
            state: profile.farmState || "",
            deliveryPreference: personalDetails.deliveryPreference || profile.deliveryPreference || "",
          });
        }
        if (verification) {
          setDocs({
            icFront: documents.icFront || null,
            icBack: documents.icBack || null,
            selfieImage: documents.selfieImage || null,
            farmerCertificate: documents.farmerCertificate || null,
          });
        }
      })
      .catch(() => { if (!savedDraft) setError(t("form.loadError")); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const missing = [
    !form.name.trim() && { id: "name", label: t("form.labels.name"), message: t("form.missing.name") },
    !form.phoneNumber.trim() && { id: "phoneNumber", label: t("form.labels.phone"), message: t("form.missing.phone") },
    !form.icNumber.trim() && { id: "icNumber", label: t("form.labels.icNumber"), message: t("form.missing.icNumber") },
    !form.farmName.trim() && { id: "farmName", label: t("form.labels.farmName"), message: t("form.missing.farmName") },
    !form.address.trim() && { id: "address", label: t("form.labels.address"), message: t("form.missing.address") },
    !form.city.trim() && { id: "city", label: t("form.labels.city"), message: t("form.missing.city") },
    !form.postcode.trim() && { id: "postcode", label: t("form.labels.postcode"), message: t("form.missing.postcode") },
    !form.state && { id: "state", label: t("form.labels.state"), message: t("form.missing.state") },
    !form.deliveryPreference && { id: "deliveryPreference", label: t("form.labels.delivery"), message: t("form.missing.delivery") },
    !docs.icFront && { id: "icFront", label: t("form.labels.icFront"), message: t("form.missing.icFront") },
    !docs.icBack && { id: "icBack", label: t("form.labels.icBack"), message: t("form.missing.icBack") },
    !docs.selfieImage && { id: "selfieImage", label: t("form.labels.selfie"), message: t("form.missing.selfie") },
  ].filter(Boolean);
  const valid = missing.length === 0;
  const errorFor = (id) => (attempted ? missing.find((item) => item.id === id)?.message : undefined);

  const next = () => {
    if (!valid) {
      setAttempted(true);
      scrollToField(missing.map((item) => item.id));
      return;
    }
    saveFarmerVerificationDraft({ form, docs });
    navigate("/verify/policy");
  };

  const status = userVal(user, "verificationStatus");
  // A rejected farmer may fix and resend their application (from /rejected, or with a saved draft).
  const resubmitting = status === "Rejected" && (searchParams.get("resubmit") === "1" || Boolean(savedDraft));
  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  if (status === "Rejected" && !resubmitting) return <Navigate to="/rejected" replace />;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <div className="mb-6 flex items-center justify-between">
          <button type="button" onClick={() => navigate(resubmitting ? "/rejected" : "/login")} aria-label={t("form.goBack")} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          <BrandLogo compact />
          <div className="w-11" />
        </div>

        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserCheck className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">{resubmitting ? t("form.resubmitTitle") : t("form.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("form.subtitle")}</p>
          </div>
        </div>

        <StepIndicator current={1} steps={STEPS} className="mt-5" />

        {resubmitting && rejectionReason && (
          <div role="note" className="mt-5 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertCircle className="h-4 w-4" />{t("form.whatToFix")}</p>
            <p className="mt-1.5 text-base leading-relaxed text-foreground">{rejectionReason}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("form.previousFilled")}</p>
          </div>
        )}

        <p className="mt-5 text-sm text-muted-foreground"><span className="font-bold text-destructive">*</span> {t("form.requiredNote")}</p>

        <FormSection title={t("form.sections.aboutYou")}>
          <FormField id="name" label={t("form.fields.name")} required error={errorFor("name")}><Input id="name" value={form.name} onChange={set("name")} autoComplete="name" placeholder={t("form.fields.namePlaceholder")} className="h-12 text-base" /></FormField>
          <FormField id="phoneNumber" label={t("form.fields.phone")} required error={errorFor("phoneNumber")}><Input id="phoneNumber" type="tel" value={form.phoneNumber} onChange={set("phoneNumber")} inputMode="tel" autoComplete="tel" placeholder={t("form.fields.phonePlaceholder")} className="h-12 text-base" /></FormField>
          <FormField id="icNumber" label={t("form.fields.icNumber")} required error={errorFor("icNumber")} hint={t("form.fields.icHint")}><Input id="icNumber" value={form.icNumber} onChange={set("icNumber")} inputMode="numeric" autoComplete="off" placeholder={t("form.fields.icPlaceholder")} className="h-12 text-base" /></FormField>
        </FormSection>

        <FormSection title={t("form.sections.yourFarm")}>
          <FormField id="farmName" label={t("form.fields.farmName")} required error={errorFor("farmName")}><Input id="farmName" value={form.farmName} onChange={set("farmName")} placeholder={t("form.fields.farmNamePlaceholder")} className="h-12 text-base" /></FormField>
          <FormField id="address" label={t("form.fields.address")} required error={errorFor("address")}><Input id="address" value={form.address} onChange={set("address")} autoComplete="street-address" placeholder={t("form.fields.addressPlaceholder")} className="h-12 text-base" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="city" label={t("form.fields.city")} required error={errorFor("city")}><Input id="city" value={form.city} onChange={set("city")} autoComplete="address-level2" placeholder={t("form.fields.cityPlaceholder")} className="h-12 text-base" /></FormField>
            <FormField id="postcode" label={t("form.fields.postcode")} required error={errorFor("postcode")}><Input id="postcode" value={form.postcode} onChange={set("postcode")} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder={t("form.fields.postcodePlaceholder")} className="h-12 text-base" /></FormField>
          </div>
          <FormField id="state" label={t("form.fields.state")} required error={errorFor("state")}>
            <Select value={form.state} onValueChange={(state) => setForm((current) => ({ ...current, state }))}>
              <SelectTrigger className="h-12"><SelectValue placeholder={t("form.fields.statePlaceholder")} /></SelectTrigger>
              <SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField id="deliveryPreference" label={t("form.fields.delivery")} required error={errorFor("deliveryPreference")} hint={t("form.fields.deliveryHint")}>
            <DeliveryMethodCards value={form.deliveryPreference} onChange={(deliveryPreference) => setForm((current) => ({ ...current, deliveryPreference }))} />
          </FormField>
        </FormSection>

        <FormSection title={t("form.sections.identityDocs")} description={t("form.sections.identityDocsDesc")}>
          <div className="rounded-2xl bg-muted/60 p-3.5">
            <p className="flex items-center gap-2 text-sm font-bold"><Camera className="h-4 w-4 text-primary" />{t("form.docs.tipsTitle")}</p>
            <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">{IC_TIPS.map((tip) => <li key={tip}>• {tip}</li>)}</ul>
          </div>
          <DocUploader id="icFront" label={t("form.docs.icFront")} required value={docs.icFront} error={errorFor("icFront")} uploadLabel={t("form.docs.icFrontUpload")} onChange={(icFront) => setDocs((current) => ({ ...current, icFront }))} />
          <DocUploader id="icBack" label={t("form.docs.icBack")} required value={docs.icBack} error={errorFor("icBack")} uploadLabel={t("form.docs.icBackUpload")} onChange={(icBack) => setDocs((current) => ({ ...current, icBack }))} />
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
            <DocUploader
              id="selfieImage"
              label={t("form.docs.selfie")}
              required
              capture="user"
              aspectClassName="mx-auto aspect-square max-w-[240px]"
              fittingType="fill"
              uploadLabel={t("form.docs.selfieUpload")}
              replaceLabel={t("form.docs.selfieRetake")}
              hint={t("form.docs.selfieHint")}
              value={docs.selfieImage}
              error={errorFor("selfieImage")}
              onChange={(selfieImage) => setDocs((current) => ({ ...current, selfieImage }))}
            />
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>• {t("form.docs.selfieTips.light")}</li>
              <li>• {t("form.docs.selfieTips.remove")}</li>
              <li>• {t("form.docs.selfieTips.alone")}</li>
            </ul>
          </div>
          <DocUploader
            label={t("form.docs.certificate")}
            hint={t("form.docs.certificateHint")}
            value={docs.farmerCertificate}
            onChange={(farmerCertificate) => setDocs((current) => ({ ...current, farmerCertificate }))}
          />
        </FormSection>

        {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

        <StickyActionBar
          standalone
          hint={valid ? t("form.hint.ready") : attempted ? t("form.hint.stillNeeded", { items: missing.map((item) => item.label).join(", ") }) : t("form.hint.remaining", { count: missing.length })}
          hintTone={valid ? "success" : attempted ? "danger" : "muted"}
        >
          <Button onClick={next} className="h-12 w-full rounded-2xl text-base font-semibold">
            {t("form.next")} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </StickyActionBar>
      </div>
    </div>
  );
}

/**
 * @param {{ title: React.ReactNode, description?: React.ReactNode, children?: React.ReactNode }} props
 */
function FormSection({ title, description, children }) {
  return (
    <section className="mt-5 space-y-4 rounded-[1.5rem] border border-border/75 bg-card p-4 shadow-[0_4px_14px_rgba(65,54,45,0.05)]">
      <div>
        <h2 className="text-lg font-extrabold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
