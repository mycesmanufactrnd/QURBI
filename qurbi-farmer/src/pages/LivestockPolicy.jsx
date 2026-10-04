import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import SignaturePad from "@/components/agri/SignaturePad";
import StepIndicator from "@/components/agri/StepIndicator";
import ReviewSummary from "@/components/agri/ReviewSummary";
import StickyActionBar from "@/components/agri/StickyActionBar";
import { cn } from "@/lib/utils";
import { DELIVERY_OPTIONS, marketplaceVisibility, newListingWindow, SELLER_POLICY_VERSION, userVal } from "@/lib/agri";
import { useLivestockDisplay } from "@/lib/livestockDisplay";
import { getDraft, clearDraft } from "@/lib/livestockDraft";

export default function LivestockPolicy() {
  const navigate = useNavigate();
  const { t } = useTranslation("livestockPolicy");
  const display = useLivestockDisplay();
  const { user } = useAuth();
  const draft = getDraft();

  // Redirect to step 1 if there's no draft (direct navigation / refresh).
  useEffect(() => {
    if (!draft) navigate("/livestock/add", { replace: true });
  }, [draft, navigate]);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(() => draft?.policySignerName || userVal(user, "name") || user?.full_name || "");
  const [date, setDate] = useState(today);
  const [agreed, setAgreed] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedSignatureUrl, setSavedSignatureUrl] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [attempted, setAttempted] = useState(false);
  const sigRef = useRef(null);
  // Hard guard against duplicate submission (double-click / retry races).
  const submittingRef = useRef(false);

  // Delivery method lives on the farmer's profile (not the listing draft).
  useEffect(() => {
    if (!user?.id) return;
    qurbi.entities.FarmerProfile.filter({ userId: user.id })
      .then((rows) => setDeliveryMethod(rows?.[0]?.deliveryPreference || ""))
      .catch(() => {});
  }, [user?.id]);

  const valid = name.trim() && date && hasSig && agreed;

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setSubmitting(true);
    try {
      // Upload the signature once; reuse the URL on retry if the upload
      // already succeeded but the create failed.
      let signatureUrl = savedSignatureUrl;
      if (!signatureUrl) {
        const dataUrl = sigRef.current?.toDataURL();
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "signature.png", { type: "image/png" });
        const res = await qurbi.integrations.Core.UploadFile({ file });
        signatureUrl = res.file_url;
        setSavedSignatureUrl(signatureUrl);
      }

      // Keep legacy draft-only fields out and omit null values that are not
      // accepted by the additive Base44 entity schema.
      const { markupConsent, ...draftData } = draft;
      let reviewAwareData = draftData;
      if (draftData.speciesRequestId) {
        const request = await qurbi.entities.SpeciesRequest.get(draftData.speciesRequestId).catch(() => null);
        if (request?.status === "Approved") {
          reviewAwareData = {
            ...reviewAwareData,
            species: request.proposedName,
            speciesApprovalStatus: "Approved",
          };
        } else if (request?.status === "Rejected") {
          reviewAwareData = {
            ...reviewAwareData,
            speciesApprovalStatus: "Rejected",
          };
        }
      }
      if (draftData.breedRequestId) {
        const request = await qurbi.entities.BreedRequest.get(draftData.breedRequestId).catch(() => null);
        if (request?.status === "Approved") {
          const approvedBreeds = await qurbi.entities.Breed.filter({
            species: request.species,
            name: request.proposedName,
          }).catch(() => []);
          reviewAwareData = {
            ...reviewAwareData,
            breed: request.proposedName,
            breedId: approvedBreeds?.[0]?.id || "",
            breedApprovalStatus: "Approved",
          };
        } else if (request?.status === "Rejected") {
          reviewAwareData = {
            ...reviewAwareData,
            breed: "Unspecified",
            breedId: "",
            breedApprovalStatus: "Rejected",
          };
        }
      }
      const listingWindow = newListingWindow();
      reviewAwareData = { ...reviewAwareData, ...listingWindow };
      const visibility = marketplaceVisibility(reviewAwareData);
      reviewAwareData = {
        ...reviewAwareData,
        marketplaceVisible: visibility.visible,
        marketplaceVisibilityReason: visibility.reason,
      };
      const livestockData = Object.fromEntries(
        Object.entries(reviewAwareData).filter(([, value]) => value !== null && value !== undefined)
      );
      await qurbi.entities.Livestock.create({
        ...livestockData,
        ownerId: user.id,
        policySignerName: name.trim(),
        policySignedDate: date,
        policySignature: signatureUrl,
        policyVersion: SELLER_POLICY_VERSION,
        policyAcceptedAt: new Date().toISOString(),
      });

      clearDraft();
      navigate("/livestock", { replace: true });
    } catch (err) {
      // Keep all entered data + the signature so the farmer can retry.
      setError(err.message || t("submitFailed"));
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  if (!draft) return null;

  const missing = [
    !name.trim() && t("missing.name"),
    !date && t("missing.date"),
    !hasSig && t("missing.signature"),
    !agreed && t("missing.agree"),
  ].filter(Boolean);
  const trySubmit = () => {
    if (!valid) { setAttempted(true); return; }
    submit();
  };
  const deliveryOption = DELIVERY_OPTIONS.find((option) => option.value === deliveryMethod);
  const deliveryLabel = deliveryOption ? display.delivery(deliveryOption.value, deliveryOption.label) : deliveryMethod;
  const statusLabel = draft.status ? display.status(draft.status).label : draft.status;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/livestock/add")}
          aria-label={t("backAria")}
          className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <StepIndicator current={2} className="mt-5" />

      {/* 1. Listing summary first, so the farmer checks what is being submitted */}
      <div className="mt-5">
        <ReviewSummary
          heading={t("summary.heading")}
          description={t("summary.description")}
          onEdit={() => navigate("/livestock/add")}
          title={display.title(draft)}
          image={draft.coverImage || draft.images?.[0]}
          species={display.species(draft?.species)}
          breed={display.breed(draft?.breed)}
          price={draft?.price}
          rows={[[t("summary.age"), draft.age ? display.age(draft) : "—"], [t("summary.gender"), draft.gender ? display.gender(draft.gender) : "—"], [t("summary.listingStatus"), statusLabel]]}
          farmLocation={draft?.state || draft?.farmLocation}
          deliveryMethod={deliveryLabel}
          signerName={name}
          signedDate={date}
        />
      </div>

      {/* 2. Policy body */}
      <section className="mt-4 rounded-2xl bg-card border border-border p-5 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">{t("policy.heading")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("policy.intro")}</p>
        </div>
        <ol className="space-y-3 text-base leading-relaxed text-foreground list-decimal pl-5">
          <li><span className="font-semibold">{t("policy.items.accurate.title")}</span> — {t("policy.items.accurate.text")}</li>
          <li><span className="font-semibold">{t("policy.items.compliance.title")}</span> — {t("policy.items.compliance.text")}</li>
          <li><span className="font-semibold">{t("policy.items.pricing.title")}</span> — {t("policy.items.pricing.text")}</li>
          <li><span className="font-semibold">{t("policy.items.delivery.title")}</span> — {t("policy.items.delivery.text")}</li>
          <li><span className="font-semibold">{t("policy.items.privacy.title")}</span> — {t("policy.items.privacy.text")}</li>
        </ol>
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />{t("policy.version", { version: SELLER_POLICY_VERSION })}</p>
      </section>

      {/* 3. Signer details */}
      <section className="mt-4 rounded-2xl bg-card border border-border p-5 space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight">{t("sign.heading")}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="signer-name" className="text-sm font-semibold">{t("sign.fullName")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input id="signer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("sign.fullNamePlaceholder")} autoComplete="name" className="h-12 text-base" aria-invalid={attempted && !name.trim()} />
          {attempted && !name.trim() && <p role="alert" className="text-sm font-medium text-destructive">{t("sign.fullNameError")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signer-date" className="text-sm font-semibold">{t("sign.date")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input
            id="signer-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-12"
          />
          <p className="text-sm text-muted-foreground">{t("sign.dateHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">{t("sign.signature")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <SignaturePad ref={sigRef} onInk={setHasSig} showError={attempted && !hasSig} />
        </div>
        <label className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-3.5", attempted && !agreed ? "bg-destructive/10 ring-1 ring-destructive/40" : "bg-accent")}>
          <Checkbox checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} className="mt-0.5 h-5 w-5" />
          <span className="text-sm leading-relaxed text-accent-foreground">
            {t("sign.agree")}
          </span>
        </label>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error} {t("errorKept")}</p>}

      <StickyActionBar
        hint={valid ? t("hint.ready") : t("hint.missing", { items: missing.join(", ") })}
        hintTone={valid ? "success" : attempted ? "danger" : "muted"}
      >
        <Button variant="outline" onClick={() => navigate("/livestock/add")} className="h-12 w-[34%] shrink-0 rounded-2xl" disabled={submitting}>
          {t("back")}
        </Button>
        <Button onClick={trySubmit} disabled={submitting} className="h-12 flex-1 rounded-2xl text-base font-semibold">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </StickyActionBar>
    </div>
  );
}
