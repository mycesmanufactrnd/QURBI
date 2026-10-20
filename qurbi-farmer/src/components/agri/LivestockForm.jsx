import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, ChevronDown, ExternalLink, FileCheck2, HandHelping, Loader2, MapPin, RotateCcw, ShieldCheck, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/agri/ImageUploader";
import VideoUploader from "@/components/agri/VideoUploader";
import DocUploader from "@/components/agri/DocUploader";
import BreedSelector from "@/components/agri/BreedSelector";
import SpeciesSelector from "@/components/agri/SpeciesSelector";
import FormField, { scrollToField } from "@/components/agri/FormField";
import StickyActionBar from "@/components/agri/StickyActionBar";
import IndividualOcrImporter from "@/components/agri/IndividualOcrImporter";
import StepIndicator from "@/components/agri/StepIndicator";
import {
  GENDERS,
  FARMER_LISTING_STATUSES,
  MALAYSIA_STATES,
  MIN_MARKETPLACE_AGE_MONTHS,
  ageInMonths,
  formatAge,
  marketplaceEligibleFrom,
  marketplaceVisibility,
} from "@/lib/agri";
import { cn } from "@/lib/utils";
import { useLivestockDisplay } from "@/lib/livestockDisplay";

function todayForInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function legacyAge(initial) {
  const match = String(initial.age || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(year|month)/i);
  if (!match) return { value: "", unit: "Months" };
  return { value: match[1], unit: match[2].toLowerCase().startsWith("year") ? "Years" : "Months" };
}

/** @typedef {{ id: string, label: string, message: string }} MissingField */

const LivestockForm = forwardRef(
  /**
   * @param {{ initial?: any, registeredState?: string, onSubmit: (data: any) => void | Promise<void>, onRequestRegistrationAssistance?: (data: any) => void, submitting?: boolean, submitLabel?: string, hideActions?: boolean, enableOcr?: boolean, onValidationChange?: (state: { missing: MissingField[], attempted: boolean }) => void }} props
   * @param {React.ForwardedRef<{ submit: () => boolean }>} ref
   */
  function LivestockForm({
  initial = {},
  registeredState = "",
  onSubmit,
  onRequestRegistrationAssistance,
  submitting,
  submitLabel,
  hideActions = false,
  enableOcr = false,
  onValidationChange,
}, ref) {
  const display = useLivestockDisplay();
  const { t } = display;
  const previousAge = legacyAge(initial);
  const initialCompliance = initial.marketplaceCompliance || {};
  const initialAssistance = initialCompliance.assistance || {};
  const [showAdvanced, setShowAdvanced] = useState(Boolean(
    initial.weight || initial.height || initial.bodyLength || initial.chestGirth ||
    initial.tagNumber || initial.earTag || initial.rfid || initial.feedDetails || initial.specialNotes
  ));
  const [form, setForm] = useState({
    species: initial.species || "",
    speciesRequestId: initial.speciesRequestId || "",
    speciesApprovalStatus: initial.speciesApprovalStatus || "Approved",
    breed: initial.breed || "",
    breedId: initial.breedId || "",
    breedRequestId: initial.breedRequestId || "",
    breedApprovalStatus: initial.breedApprovalStatus || (initial.breed === "Unspecified" ? "Unspecified" : "Approved"),
    ageInputMode: initial.ageInputMode || (initial.birthDate ? "Birth Date" : "Age"),
    birthDate: initial.birthDate || "",
    ageValue: initial.ageValue ?? previousAge.value,
    ageUnit: initial.ageUnit || previousAge.unit,
    ageRecordedAt: initial.ageRecordedAt || todayForInput(),
    gender: initial.gender || "",
    state: initial.state || initial.farmLocation || registeredState || "",
    price: initial.price ?? "",
    color: initial.color || "",
    description: initial.description || "",
    weight: initial.weight || "",
    height: initial.height || "",
    bodyLength: initial.bodyLength || "",
    chestGirth: initial.chestGirth || "",
    tagNumber: initial.tagNumber || initial.earTag || "",
    rfid: initial.rfid || "",
    feedDetails: initial.feedDetails || "",
    specialNotes: initial.specialNotes || "",
    status: initial.status || "Available",
    healthCertificateUrl: initialCompliance.healthCertificateUrl || "",
    vaccinationRecordUrl: initialCompliance.vaccinationRecordUrl || "",
    requestRegistrationAssistance: Boolean(initialAssistance.requested),
    assistanceContactName: initialAssistance.contactName || "",
    assistancePhone: initialAssistance.phone || "",
    assistanceIdentityNumber: initialAssistance.identityOrCompanyNumber || "",
    assistancePremiseId: initialAssistance.premiseId || "",
    assistanceFarmAddress: initialAssistance.farmAddress || "",
    assistanceAnimalCount: initialAssistance.animalCount || 1,
    assistanceNotes: initialAssistance.notes || "",
  });
  const [images, setImages] = useState(initial.images || []);
  const [videos, setVideos] = useState(initial.videos || []);
  const [cover, setCover] = useState(initial.coverImage || initial.images?.[0] || null);
  const [ageTouched, setAgeTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setFromInput = (key) => (event) => setValue(key, event.target.value);

  const preview = useMemo(() => {
    const ageRecordedAt = ageTouched ? todayForInput() : form.ageRecordedAt;
    const data = { ...form, ageRecordedAt };
    return { age: display.age(data), visibility: marketplaceVisibility(data) };
  }, [form, ageTouched, t]);

  const ageRecordedAt = ageTouched ? todayForInput() : form.ageRecordedAt;
  const agePolicyData = { ...form, ageRecordedAt };
  const minimumMarketplaceAge = MIN_MARKETPLACE_AGE_MONTHS[form.species];
  const currentAgeMonths = ageInMonths(agePolicyData);
  const isBelowMarketplaceAge = Boolean(
    minimumMarketplaceAge &&
    currentAgeMonths !== null &&
    currentAgeMonths < minimumMarketplaceAge
  );
  const eligibleFrom = isBelowMarketplaceAge ? marketplaceEligibleFrom(agePolicyData) : "";
  const eligibleFromLabel = eligibleFrom
    ? new Intl.DateTimeFormat(display.locale, { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(`${eligibleFrom}T00:00:00`))
    : "";

  const validAge = form.ageInputMode === "Birth Date"
    ? Boolean(form.birthDate) && form.birthDate <= todayForInput()
    : form.ageValue !== "" && Number(form.ageValue) >= 0;

  /** @type {MissingField[]} */
  const missing = useMemo(() => {
    const list = [];
    if (!images.length) list.push({ id: "photos", label: t("form.missing.photos.label"), message: t("form.missing.photos.message") });
    if (!form.species) list.push({ id: "species", label: t("form.missing.species.label"), message: t("form.missing.species.message") });
    if (!form.gender) list.push({ id: "gender", label: t("form.missing.gender.label"), message: t("form.missing.gender.message") });
    if (!form.breed) list.push({ id: "breed", label: t("form.missing.breed.label"), message: t("form.missing.breed.message") });
    if (!form.state) list.push({ id: "state", label: t("form.missing.state.label"), message: t("form.missing.state.message") });
    if (!validAge) list.push({ id: "age", label: t("form.missing.age.label"), message: form.ageInputMode === "Birth Date" ? t("form.missing.age.messageBirth") : t("form.missing.age.messageAge") });
    if (form.price === "" || Number(form.price) < 0 || Number.isNaN(Number(form.price))) list.push({ id: "price", label: t("form.missing.price.label"), message: t("form.missing.price.message") });
    if (!form.status) list.push({ id: "status", label: t("form.missing.status.label"), message: t("form.missing.status.message") });
    return list;
  }, [images.length, form.species, form.gender, form.breed, form.state, validAge, form.ageInputMode, form.price, form.status, t]);
  const valid = missing.length === 0;
  const errorFor = (id) => (attempted ? missing.find((item) => item.id === id)?.message : undefined);

  useEffect(() => {
    onValidationChange?.({ missing, attempted });
  }, [missing, attempted, onValidationChange]);

  const buildNormalized = (sourceForm = form) => ({
    ...sourceForm,
    ageValue: sourceForm.ageInputMode === "Age" ? Number(sourceForm.ageValue) : null,
    ageRecordedAt: ageTouched ? todayForInput() : sourceForm.ageRecordedAt,
    birthDate: sourceForm.ageInputMode === "Birth Date" ? sourceForm.birthDate : "",
    price: sourceForm.price === "" ? "" : Number(sourceForm.price),
    images,
    videos,
    coverImage: cover || images[0] || null,
    farmLocation: sourceForm.state,
    marketplaceCompliance: {
      ...(initialCompliance || {}),
      earTagId: sourceForm.tagNumber.trim(),
      healthCertificateUrl: sourceForm.healthCertificateUrl,
      vaccinationRecordUrl: sourceForm.vaccinationRecordUrl,
      assistance: {
        ...(initialAssistance || {}),
        requested: sourceForm.requestRegistrationAssistance,
        contactName: sourceForm.assistanceContactName.trim(),
        phone: sourceForm.assistancePhone.trim(),
        identityOrCompanyNumber: sourceForm.assistanceIdentityNumber.trim(),
        premiseId: sourceForm.assistancePremiseId.trim(),
        farmAddress: sourceForm.assistanceFarmAddress.trim(),
        state: sourceForm.state,
        animalCount: Number(sourceForm.assistanceAnimalCount || 1),
        notes: sourceForm.assistanceNotes.trim(),
      },
    },
  });

  const submit = () => {
    if (!valid) {
      setAttempted(true);
      const firstMissing = missing[0]?.id;
      const targetStep = ["species", "gender", "breed", "age", "state"].includes(firstMissing) ? 1 : ["price", "status"].includes(firstMissing) ? 2 : 4;
      setCurrentStep(targetStep);
      window.setTimeout(() => scrollToField(missing.map((item) => item.id)), 0);
      return false;
    }

    const normalized = buildNormalized();
    const visibility = marketplaceVisibility(normalized);
    onSubmit({
      ...normalized,
      age: formatAge(normalized),
      marketplaceVisible: visibility.visible,
      marketplaceVisibilityReason: visibility.reason,
      marketplaceEligibleFrom: marketplaceEligibleFrom(normalized),
    });
    return true;
  };

  useImperativeHandle(ref, () => ({ submit }));

  const openRegistrationAssistance = () => {
    const nextForm = { ...form, requestRegistrationAssistance: true };
    setForm(nextForm);
    onRequestRegistrationAssistance?.(buildNormalized(nextForm));
  };

  const changeSpecies = ({ species, speciesRequestId, speciesApprovalStatus }) => {
    setForm((current) => ({
      ...current,
      species,
      speciesRequestId,
      speciesApprovalStatus,
      breed: speciesApprovalStatus === "Pending" ? "Unspecified" : "",
      breedId: "",
      breedRequestId: "",
      breedApprovalStatus: "Unspecified",
    }));
  };

  const applyOcrResult = (result) => {
    const validBirthDate = result.birthDate && result.birthDate <= todayForInput() ? result.birthDate : "";
    const validAgeMonths = !validBirthDate && Number.isInteger(Number(result.ageMonths)) && Number(result.ageMonths) >= 0
      ? String(result.ageMonths)
      : "";
    setForm((current) => {
      const speciesChanged = Boolean(result.species && current.species !== result.species);
      return {
        ...current,
        species: result.species || current.species,
        speciesRequestId: result.species ? "" : current.speciesRequestId,
        speciesApprovalStatus: result.species ? "Approved" : current.speciesApprovalStatus,
        breed: result.breed || (speciesChanged ? "" : current.breed),
        breedId: result.breed ? result.breedId || "" : (speciesChanged ? "" : current.breedId),
        breedRequestId: result.breed ? "" : (speciesChanged ? "" : current.breedRequestId),
        breedApprovalStatus: result.breed ? "Approved" : (speciesChanged ? "Unspecified" : current.breedApprovalStatus),
        gender: result.gender || current.gender,
        state: result.state || current.state,
        color: result.color || current.color,
        tagNumber: result.animalId || current.tagNumber,
        weight: result.weight || current.weight,
        description: result.description || current.description,
        ageInputMode: validBirthDate ? "Birth Date" : validAgeMonths ? "Age" : current.ageInputMode,
        birthDate: validBirthDate || current.birthDate,
        ageValue: validBirthDate ? "" : validAgeMonths || current.ageValue,
        ageRecordedAt: validBirthDate || validAgeMonths ? todayForInput() : current.ageRecordedAt,
      };
    });
    if (validBirthDate || validAgeMonths) setAgeTouched(true);
    if (result.animalId || result.weight) setShowAdvanced(true);
  };

  const sectionDone = {
    1: images.length > 0,
    2: Boolean(form.species && form.gender && form.breed && form.state),
    3: validAge,
    4: form.price !== "" && Number(form.price) >= 0 && Boolean(form.status),
    5: Boolean(form.tagNumber && form.healthCertificateUrl && form.vaccinationRecordUrl),
  };

  const stepMissing = currentStep === 1
    ? missing.filter((item) => ["species", "gender", "breed", "age", "state"].includes(item.id))
    : currentStep === 2
      ? missing.filter((item) => ["price", "status"].includes(item.id))
      : currentStep === 3
        ? []
        : currentStep === 4
          ? missing.filter((item) => item.id === "photos")
          : missing;

  const goNext = () => {
    if (stepMissing.length) {
      setAttempted(true);
      scrollToField(stepMissing.map((item) => item.id));
      return;
    }
    setCurrentStep((step) => Math.min(5, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const wizardSteps = [
    { n: 1, label: t("form.wizard.animal") },
    { n: 2, label: t("form.wizard.listing") },
    { n: 3, label: t("form.wizard.compliance") },
    { n: 4, label: t("form.wizard.media") },
    { n: 5, label: t("form.wizard.review") },
  ];

  return (
    <div>
      <StepIndicator current={currentStep} steps={wizardSteps} className="pb-1" />

      {currentStep === 4 && <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <Section title={t("form.sections.photosTitle")} step={1} done={sectionDone[1]} description={t("form.sections.photosDescription")}>
          <div className="space-y-5">
            <FormField id="photos" label={t("form.fields.photos")} required error={errorFor("photos")}>
              <ImageUploader value={images} cover={cover} onChange={(nextImages, nextCover) => { setImages(nextImages); setCover(nextCover); }} />
            </FormField>
            <FormField label={t("form.fields.videos")} optional>
              <VideoUploader value={videos} onChange={setVideos} />
            </FormField>
          </div>
        </Section>
      </div>}

      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        {currentStep === 1 && <>
        {enableOcr && <IndividualOcrImporter onApply={applyOcrResult} />}
        <Section title={t("form.sections.aboutTitle")} step={2} done={sectionDone[2]}>
          <div className="space-y-4">
            <Grid>
              <FormField id="species" label={t("form.fields.species")} required error={errorFor("species")}>
                <SpeciesSelector
                  value={form.species}
                  onChange={changeSpecies}
                />
              </FormField>
              <FormField id="gender" label={t("form.fields.gender")} required error={errorFor("gender")}>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("form.fields.gender")}>
                  {GENDERS.map((gender) => {
                    const selected = form.gender === gender;
                    return (
                      <button
                        key={gender}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setValue("gender", gender)}
                        className={cn(
                          "h-12 rounded-xl border px-3 text-sm font-semibold transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {display.gender(gender)}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            </Grid>

            <FormField id="breed" label={t("form.fields.breed")} required error={errorFor("breed")} hint={!form.species ? t("form.fields.breedHint") : undefined}>
              {form.speciesApprovalStatus === "Pending" ? (
                <div className="space-y-2"><Input value={t("breed.Unspecified")} readOnly className="h-12 bg-muted" /><p className="text-sm text-muted-foreground">{t("form.fields.breedPendingNote")}</p></div>
              ) : <BreedSelector
                species={form.species}
                value={form.breed}
                approvalStatus={form.breedApprovalStatus}
                requestId={form.breedRequestId}
                livestockId={initial.id}
                onChange={(breedFields) => setForm((current) => ({ ...current, ...breedFields }))}
              />}
            </FormField>

            <Grid>
              <FormField label={t("form.fields.colour")} optional>
                <Input value={form.color} onChange={setFromInput("color")} placeholder={t("form.fields.colourPlaceholder")} className="h-12" />
              </FormField>
              <FormField id="state" label={t("form.fields.state")} required error={errorFor("state")}>
                <Select value={form.state} onValueChange={(value) => setValue("state", value)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder={t("form.fields.statePlaceholder")} /></SelectTrigger>
                  <SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            </Grid>

            {registeredState && (
              <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {form.state === registeredState ? t("form.fields.usingRegisteredState") : t("form.fields.usingOtherState")}
                </span>
                {form.state !== registeredState && (
                  <button type="button" onClick={() => setValue("state", registeredState)} className="flex min-h-11 shrink-0 items-center gap-1 px-2 font-semibold text-primary hover:underline">
                    <RotateCcw className="h-3.5 w-3.5" /> {t("form.fields.useFarmState")}
                  </button>
                )}
              </div>
            )}

            <FormField label={t("form.fields.description")} optional hint={t("form.fields.descriptionHint")}>
              <Textarea value={form.description} onChange={setFromInput("description")} placeholder={t("form.fields.descriptionPlaceholder")} rows={3} className="resize-none text-base" />
            </FormField>
          </div>
        </Section>

        <Section title={t("form.sections.ageTitle")} step={3} done={sectionDone[3]} description={t("form.sections.ageDescription")}>
          <div id="field-age" className="scroll-mt-24 space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("form.fields.ageModeAria")}>
              {["Birth Date", "Age"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={form.ageInputMode === mode}
                  onClick={() => { setValue("ageInputMode", mode); setAgeTouched(true); }}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                    form.ageInputMode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "Age" ? t("form.fields.ageModeAge") : t("form.fields.ageModeBirth")}
                </button>
              ))}
            </div>

            {form.ageInputMode === "Birth Date" ? (
              <FormField label={t("form.fields.birthDate")} required error={errorFor("age")}>
                <Input type="date" max={todayForInput()} value={form.birthDate} onChange={(event) => { setValue("birthDate", event.target.value); setAgeTouched(true); }} className="h-12" />
              </FormField>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("form.fields.age")} required>
                    <Input type="number" inputMode="numeric" min="0" step="1" value={form.ageValue} onChange={(event) => { setValue("ageValue", event.target.value); setAgeTouched(true); }} placeholder={t("form.fields.agePlaceholder")} aria-invalid={Boolean(errorFor("age"))} className="h-12" />
                  </FormField>
                  <FormField label={t("form.fields.unit")} required>
                    <Select value={form.ageUnit} onValueChange={(value) => { setValue("ageUnit", value); setAgeTouched(true); }}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Months">{t("form.fields.unitMonths")}</SelectItem><SelectItem value="Years">{t("form.fields.unitYears")}</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                </div>
                {errorFor("age") && <InlineError>{errorFor("age")}</InlineError>}
              </div>
            )}

            <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">{t("form.fields.buyersWillSee")} <span className="font-semibold text-foreground">{preview.age}</span>. {t("form.fields.ageAutoUpdates")}</p>
            {minimumMarketplaceAge && (
              <div className={cn(
                "rounded-xl border px-3 py-3 text-sm leading-5",
                isBelowMarketplaceAge
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-sky-200 bg-sky-50 text-sky-900"
              )}>
                <p className="font-bold">{t("form.agePolicy.title")}</p>
                <p className="mt-0.5">{t("form.agePolicy.minimum", {
                  species: display.species(form.species),
                  count: minimumMarketplaceAge,
                })}</p>
                {isBelowMarketplaceAge && eligibleFromLabel && (
                  <p className="mt-1 font-semibold">{t("form.agePolicy.underage", { date: eligibleFromLabel })}</p>
                )}
              </div>
            )}
          </div>
        </Section>

        <div className="soft-card overflow-hidden rounded-[1.5rem]">
          <button type="button" onClick={() => setShowAdvanced((current) => !current)} aria-expanded={showAdvanced} className="flex min-h-[72px] w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/40">
            <span>
              <span className="block text-base font-bold">{t("form.sections.moreTitle")} <span className="font-normal text-muted-foreground">{t("form.sections.moreOptional")}</span></span>
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{t("form.sections.moreDescription")}</span>
            </span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", showAdvanced && "rotate-180")} />
          </button>
          {showAdvanced && (
            <div className="animate-fade-in space-y-4 border-t border-border/60 px-5 pb-5 pt-4">
              <Grid>
                <FormField label={t("form.fields.weight")}><Input inputMode="decimal" value={form.weight} onChange={setFromInput("weight")} className="h-12" /></FormField>
                <FormField label={t("form.fields.height")}><Input inputMode="decimal" value={form.height} onChange={setFromInput("height")} className="h-12" /></FormField>
              </Grid>
              <Grid>
                <FormField label={t("form.fields.bodyLength")}><Input inputMode="decimal" value={form.bodyLength} onChange={setFromInput("bodyLength")} className="h-12" /></FormField>
                <FormField label={t("form.fields.chestGirth")}><Input inputMode="decimal" value={form.chestGirth} onChange={setFromInput("chestGirth")} className="h-12" /></FormField>
              </Grid>
              <FormField label={t("form.fields.rfid")}><Input value={form.rfid} onChange={setFromInput("rfid")} className="h-12" /></FormField>
              <FormField label={t("form.fields.feed")}><Textarea value={form.feedDetails} onChange={setFromInput("feedDetails")} placeholder={t("form.fields.feedPlaceholder")} rows={2} className="resize-none text-base" /></FormField>
              <FormField label={t("form.fields.specialNotes")}><Textarea value={form.specialNotes} onChange={setFromInput("specialNotes")} rows={2} className="resize-none text-base" /></FormField>
            </div>
          )}
        </div>
        </>}

        {currentStep === 2 &&
        <Section title={t("form.sections.priceTitle")} step={4} done={sectionDone[4]}>
          <div className="space-y-4">
            <FormField id="price" label={t("form.fields.price")} required error={errorFor("price")} hint={t("form.fields.priceHint")}>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={setFromInput("price")} placeholder={t("form.fields.pricePlaceholder")} aria-invalid={Boolean(errorFor("price"))} className="h-12 pl-9 text-base" />
              </div>
            </FormField>
            <FormField id="status" label={t("form.fields.visibility")} required error={errorFor("status")} hint={form.status ? t(`form.statusHelp.${form.status}`, { defaultValue: "" }) || undefined : undefined}>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("form.fields.visibilityAria")}>
                {FARMER_LISTING_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={form.status === status}
                    onClick={() => setValue("status", status)}
                    className={cn(
                      "min-h-11 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors",
                      form.status === status ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {display.status(status).label}
                  </button>
                ))}
              </div>
            </FormField>
            {form.status === "Available" && !preview.visibility.visible && preview.visibility.reason && !/^Status is/.test(preview.visibility.reason) && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{(() => { const reason = display.visibilityReason(preview.visibility.reason); return t("form.fields.notVisibleYet", { reason: reason.charAt(0).toLowerCase() + reason.slice(1) }); })()}</p>
            )}
          </div>
        </Section>
        }

        {currentStep === 3 && <ComplianceStep
          form={form}
          setValue={setValue}
          t={t}
          sectionDone={sectionDone[5]}
          onRequestAssistance={openRegistrationAssistance}
        />}

        {currentStep === 5 && <section className="soft-card rounded-[1.5rem] p-4 sm:p-5">
          <h2 className="text-lg font-extrabold">{t("form.wizard.reviewTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("form.wizard.reviewDescription")}</p>
          <dl className="mt-4 divide-y divide-border/60 rounded-2xl bg-muted/40 px-4">
            <ReviewRow label={t("form.fields.species")} value={form.species || t("form.wizard.notSet")} />
            <ReviewRow label={t("form.fields.breed")} value={form.breed || t("form.wizard.notSet")} />
            <ReviewRow label={t("form.fields.gender")} value={form.gender ? display.gender(form.gender) : t("form.wizard.notSet")} />
            <ReviewRow label={t("form.fields.age")} value={preview.age} />
            <ReviewRow label={t("form.fields.state")} value={form.state || t("form.wizard.notSet")} />
            <ReviewRow label={t("form.fields.price")} value={form.price === "" ? t("form.wizard.notSet") : `RM ${Number(form.price).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <ReviewRow label={t("form.fields.visibility")} value={form.status ? display.status(form.status).label : t("form.wizard.notSet")} />
            <ReviewRow label={t("form.compliance.reviewLabel")} value={form.tagNumber && form.healthCertificateUrl && form.vaccinationRecordUrl ? t("form.compliance.readyForReview") : form.requestRegistrationAssistance ? t("form.compliance.assistanceRequested") : t("form.compliance.savedAsDraft")} />
            <ReviewRow label={t("form.fields.photos")} value={t("form.wizard.photoCount", { count: images.length })} />
          </dl>
          {missing.length > 0 && <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"><MissingSummary missing={missing} /></div>}
        </section>}
      </div>

      {!hideActions && (
        <div>
          <StickyActionBar
            hint={attempted && stepMissing.length ? <MissingSummary missing={stepMissing} /> : t("form.wizard.step", { current: currentStep, total: 5 })}
            hintTone="danger"
          >
            {currentStep > 1 && <Button type="button" variant="outline" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={submitting} className="h-12 w-[34%] shrink-0 rounded-2xl"><ArrowLeft className="mr-1.5 h-4 w-4" />{t("form.wizard.back")}</Button>}
            {currentStep < 5
              ? <Button type="button" onClick={goNext} className="h-12 flex-1 rounded-2xl text-base font-semibold">{t("form.wizard.next")}<ArrowRight className="ml-1.5 h-5 w-5" /></Button>
              : <Button onClick={submit} disabled={submitting} className="h-12 flex-1 rounded-2xl text-base font-semibold">{submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{submitLabel || t("form.submitLabel")}</Button>}
          </StickyActionBar>
        </div>
      )}
    </div>
  );
});

export default LivestockForm;

/** "Still needed: Photo, Breed, Price" — each item jumps to its field. */
export function MissingSummary({ missing }) {
  const { t } = useLivestockDisplay();
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">{t("form.stillNeeded")}</span>
      {missing.map((item, index) => (
        <span key={item.id} className="whitespace-nowrap">
          <button type="button" onClick={() => scrollToField([item.id])} className="min-h-6 font-semibold underline underline-offset-2">{item.label}</button>
          {index < missing.length - 1 && <span aria-hidden="true">,</span>}
        </span>
      ))}
    </span>
  );
}

function ComplianceStep({ form, setValue, t, sectionDone, onRequestAssistance }) {
  const evidenceComplete = Boolean(
    form.tagNumber && form.healthCertificateUrl && form.vaccinationRecordUrl
  );

  return (
    <Section
      title={t("form.compliance.title")}
      done={sectionDone}
      description={t("form.compliance.description")}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          <p className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5" />{t("form.compliance.policyTitle")}</p>
          <p className="mt-1">{t("form.compliance.policyText")}</p>
          <a href="https://www.dvs.gov.my/index.php/pages/view/1945" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1 font-bold underline underline-offset-2">
            {t("form.compliance.dvsLink")}<ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <FormField id="earTag" label={t("form.compliance.earTagLabel")} hint={t("form.compliance.earTagHint")}>
          <Input value={form.tagNumber} onChange={(event) => setValue("tagNumber", event.target.value)} placeholder={t("form.compliance.earTagPlaceholder")} className="h-12" />
        </FormField>

        <DocUploader
          id="healthCertificate"
          label={t("form.compliance.healthCertificateLabel")}
          hint={t("form.compliance.healthCertificateHint")}
          value={form.healthCertificateUrl}
          onChange={(value) => setValue("healthCertificateUrl", value || "")}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          documentMode
          aspectClassName="min-h-36"
          uploadLabel={t("form.compliance.uploadEvidence")}
        />

        <DocUploader
          id="vaccinationRecord"
          label={t("form.compliance.vaccinationLabel")}
          hint={t("form.compliance.vaccinationHint")}
          value={form.vaccinationRecordUrl}
          onChange={(value) => setValue("vaccinationRecordUrl", value || "")}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          documentMode
          aspectClassName="min-h-36"
          uploadLabel={t("form.compliance.uploadEvidence")}
        />

        <div className={cn("rounded-2xl border p-4 text-sm", evidenceComplete ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950")}>
          <p className="flex items-center gap-2 font-extrabold"><FileCheck2 className="h-5 w-5" />{evidenceComplete ? t("form.compliance.completeTitle") : t("form.compliance.incompleteTitle")}</p>
          <p className="mt-1 leading-5">{evidenceComplete ? t("form.compliance.completeText") : t("form.compliance.incompleteText")}</p>
        </div>

        <div className={cn("rounded-2xl border p-4", form.requestRegistrationAssistance ? "border-emerald-200 bg-emerald-50" : "border-border bg-muted/35")}>
          <div className="flex items-start gap-3">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", form.requestRegistrationAssistance ? "bg-emerald-600 text-white" : "bg-card text-primary ring-1 ring-border")}><HandHelping className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold text-foreground">{t("form.compliance.requestHelp")}</p>
                {form.requestRegistrationAssistance && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase text-emerald-800">{t("form.compliance.selected")}</span>}
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("form.compliance.requestHelpText")}</p>
            </div>
          </div>
          <button type="button" onClick={onRequestAssistance} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
            {form.requestRegistrationAssistance ? t("form.compliance.editRequest") : t("form.compliance.openRequestPage")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Section>
  );
}

function InlineError({ children }) {
  return <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{children}</p>;
}

/**
 * @param {{ title: React.ReactNode, step: number, done?: boolean, description?: React.ReactNode, children?: React.ReactNode }} props
 */
function Section({ title, done = false, description, children }) {
  return (
    <section className="soft-card rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4">
        {done && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm" aria-hidden="true">✓</span>}
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function ReviewRow({ label, value }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="max-w-[60%] break-words text-right text-sm font-bold">{value}</dd></div>;
}
