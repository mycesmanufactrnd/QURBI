import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2, Users } from "lucide-react";
import ImageUploader from "@/components/agri/ImageUploader";
import VideoUploader from "@/components/agri/VideoUploader";
import StickyActionBar from "@/components/agri/StickyActionBar";
import SpeciesSelector from "@/components/agri/SpeciesSelector";
import BulkOcrImporter from "@/components/agri/BulkOcrImporter";
import { MALAYSIA_STATES, breedsFor } from "@/lib/agri";

const newBreakdown = () => ({ species: "", breed: "", maleCount: "", femaleCount: "" });

const normalizeBreakdown = (listing) => {
  const rows = listing?.breedBreakdown?.length ? listing.breedBreakdown : [newBreakdown()];
  const singleLegacyBreed = rows.length === 1 && rows[0].maleCount == null && rows[0].femaleCount == null;

  return rows.map((row) => ({
    ...row,
    maleCount: row.maleCount ?? (singleLegacyBreed ? listing.maleCount ?? "" : ""),
    femaleCount: row.femaleCount ?? (singleLegacyBreed ? listing.femaleCount ?? "" : ""),
  }));
};

export default function AddBulkListing() {
  const { t } = useTranslation("bulk");
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "", images: [], videos: [], coverImage: "",
    breedBreakdown: [newBreakdown()], state: "", totalPrice: "", status: "Available",
  });
  const [managedBreeds, setManagedBreeds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      qurbi.entities.FarmerProfile.filter({ userId: user.id }, "-created_date", 1),
      qurbi.entities.Breed.list("name", 500),
      editing ? qurbi.entities.BulkListing.get(id) : Promise.resolve(null),
    ]).then(([profiles, breeds, listing]) => {
      setForm((current) => listing ? {
        name: listing.name || "",
        images: listing.images || [],
        videos: listing.videos || [],
        coverImage: listing.coverImage || listing.images?.[0] || "",
        breedBreakdown: normalizeBreakdown(listing),
        state: listing.state || profiles?.[0]?.state || "",
        totalPrice: listing.totalPrice ?? "",
        status: listing.status || "Available",
      } : ({ ...current, state: current.state || profiles?.[0]?.state || "" }));
      setManagedBreeds(breeds || []);
    }).catch((loadError) => {
      if (editing) {
        alert(loadError.message || t("form.loadFailed"));
        navigate("/bulk", { replace: true });
      }
    }).finally(() => setLoading(false));
  }, [editing, id, navigate, user?.id]);

  const maleTotal = useMemo(() => form.breedBreakdown.reduce((sum, row) => sum + Number(row.maleCount || 0), 0), [form.breedBreakdown]);
  const femaleTotal = useMemo(() => form.breedBreakdown.reduce((sum, row) => sum + Number(row.femaleCount || 0), 0), [form.breedBreakdown]);
  const animalTotal = maleTotal + femaleTotal;
  const breakdownValid = form.breedBreakdown.length > 0 && form.breedBreakdown.every((row) => {
    const male = Number(row.maleCount || 0);
    const female = Number(row.femaleCount || 0);
    return row.species && row.breed && Number.isInteger(male) && Number.isInteger(female) && male >= 0 && female >= 0 && male + female > 0;
  });
  const breedKeys = form.breedBreakdown.filter((row) => row.species && row.breed).map((row) => `${row.species}:${row.breed}`);
  const hasDuplicateBreed = new Set(breedKeys).size !== breedKeys.length;
  const valid = Boolean(form.name.trim() && form.images.length && form.state && Number(form.totalPrice) > 0 && breakdownValid && !hasDuplicateBreed);
  const missing = [
    !form.images.length && t("form.missing.photo"),
    !form.name.trim() && t("form.missing.name"),
    !breakdownValid && t("form.missing.breakdown"),
    hasDuplicateBreed && t("form.missing.duplicate"),
    !form.state && t("form.missing.state"),
    !(Number(form.totalPrice) > 0) && t("form.missing.price"),
  ].filter(Boolean);

  const updateBreakdown = (index, changes) => setForm((current) => ({
    ...current,
    breedBreakdown: current.breedBreakdown.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row),
  }));

  const applyOcrResult = (result) => {
    setForm((current) => ({
      ...current,
      state: result.state || current.state,
      breedBreakdown: result.groups?.length
        ? result.groups.map((group) => ({ species: group.species, breed: group.breed, maleCount: String(group.maleCount || 0), femaleCount: String(group.femaleCount || 0) }))
        : current.breedBreakdown,
    }));
  };

  const submit = async () => {
    if (submitting) return;
    if (!valid) { setAttempted(true); return; }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        images: form.images,
        videos: form.videos,
        coverImage: form.coverImage || form.images[0],
        maleCount: maleTotal,
        femaleCount: femaleTotal,
        breedBreakdown: form.breedBreakdown.map((row) => {
          const maleCount = Number(row.maleCount || 0);
          const femaleCount = Number(row.femaleCount || 0);
          return { ...row, maleCount, femaleCount, count: maleCount + femaleCount };
        }),
        state: form.state,
        totalPrice: Number(form.totalPrice),
        status: form.status,
        marketplaceVisible: form.status === "Available",
      };
      if (editing) await qurbi.entities.BulkListing.update(id, payload);
      else await qurbi.entities.BulkListing.create({ ...payload, ownerId: user.id });
      navigate(editing ? `/bulk/${id}` : "/bulk", { replace: true });
    } catch (submissionError) {
      setError(submissionError.message || t("form.saveFailed"));
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in pb-8">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(editing ? `/bulk/${id}` : "/bulk")} aria-label={t("form.back")} className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{editing ? t("form.editTitle") : t("form.addTitle")}</h1><p className="mt-1 text-sm text-muted-foreground">{editing ? t("form.editSubtitle") : t("form.addSubtitle")}</p></div>
      </div>

      {!editing && <BulkOcrImporter managedBreeds={managedBreeds} onApply={applyOcrResult} />}

      <Section title={t("form.sections.media")}>
        <p className="text-sm font-semibold">{t("form.photos")} <span className="text-destructive" aria-hidden="true">*</span></p>
        <ImageUploader value={form.images} cover={form.coverImage} onChange={(images, coverImage) => setForm((current) => ({ ...current, images, coverImage }))} />
        {attempted && !form.images.length && <p role="alert" className="text-sm font-medium text-destructive">{t("form.photoRequired")}</p>}
        <p className="pt-1 text-sm font-semibold">{t("form.videos")} <span className="font-normal text-muted-foreground">{t("form.optional")}</span></p>
        <VideoUploader value={form.videos} onChange={(videos) => setForm((current) => ({ ...current, videos }))} buttonLabel={t("form.videoButton")} />
      </Section>

      <Section title={t("form.sections.details")}>
        <Field label={t("form.listingName")} required error={attempted && !form.name.trim() ? t("form.nameError") : ""}><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("form.namePlaceholder")} className="h-12 text-base" /></Field>
        <p className="text-sm text-muted-foreground">{t("form.countHelp")}</p>
        <div className="grid grid-cols-3 gap-2.5">
          <CountSummary label={t("animalsLabel")} value={animalTotal} />
          <CountSummary label={t("male")} value={maleTotal} />
          <CountSummary label={t("female")} value={femaleTotal} />
        </div>
      </Section>

      <Section title={t("form.sections.breeds")}>
        {form.breedBreakdown.map((row, index) => (
          <div key={index} className="rounded-2xl border border-border p-3 space-y-3">
            <div className="flex min-h-11 items-center justify-between"><p className="text-sm font-bold">{t("form.breedGroup", { index: index + 1 })}</p>{form.breedBreakdown.length > 1 && <button type="button" aria-label={t("form.removeGroupAria", { index: index + 1 })} onClick={() => setForm((current) => ({ ...current, breedBreakdown: current.breedBreakdown.filter((_, rowIndex) => rowIndex !== index) }))} className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" />{t("form.remove")}</button>}</div>
            <div aria-label={t("form.speciesAria", { index: index + 1 })}>
              <SpeciesSelector
                value={row.species}
                onChange={({ species }) => updateBreakdown(index, { species, breed: "" })}
              />
            </div>
            <Select value={row.breed} onValueChange={(breed) => updateBreakdown(index, { breed })} disabled={!row.species}>
              <SelectTrigger className="h-12" aria-label={t("form.breedAria", { index: index + 1 })}><SelectValue placeholder={row.species ? t("form.selectBreed") : t("form.chooseSpeciesFirst")} /></SelectTrigger>
              <SelectContent>{breedsFor(row.species, managedBreeds).map((breed) => <SelectItem key={breed} value={breed}>{breed}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("male")}><Input type="number" inputMode="numeric" min="0" step="1" value={row.maleCount} onChange={(event) => updateBreakdown(index, { maleCount: event.target.value })} placeholder="0" className="h-12" /></Field>
              <Field label={t("female")}><Input type="number" inputMode="numeric" min="0" step="1" value={row.femaleCount} onChange={(event) => updateBreakdown(index, { femaleCount: event.target.value })} placeholder="0" className="h-12" /></Field>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm font-semibold text-muted-foreground"><Users className="h-4 w-4 text-primary" />{t("form.thisBreed")} <strong className="text-foreground">{t("animals", { count: Number(row.maleCount || 0) + Number(row.femaleCount || 0) })}</strong></div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, breedBreakdown: [...current.breedBreakdown, newBreakdown()] }))} className="h-12 w-full rounded-xl"><Plus className="w-4 h-4 mr-2" /> {t("form.addBreed")}</Button>
        <p className={`text-sm ${breakdownValid && !hasDuplicateBreed ? "text-primary" : attempted ? "text-destructive" : "text-muted-foreground"}`}>{t("form.recordedTotal", { total: animalTotal, male: maleTotal, female: femaleTotal })}</p>
        {hasDuplicateBreed && <p role="alert" className="text-sm text-destructive">{t("form.duplicateError")}</p>}
      </Section>

      <Section title={t("form.sections.locationPrice")}>
        <Field label={t("form.state")} required error={attempted && !form.state ? t("form.stateError") : ""}><Select value={form.state} onValueChange={(state) => setForm((current) => ({ ...current, state }))}><SelectTrigger className="h-12"><SelectValue placeholder={t("form.selectState")} /></SelectTrigger><SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></Field>
        <Field label={t("form.totalPrice")} required error={attempted && !(Number(form.totalPrice) > 0) ? t("form.priceError") : ""}><Input type="number" inputMode="decimal" min="0" step="0.01" value={form.totalPrice} onChange={(event) => setForm((current) => ({ ...current, totalPrice: event.target.value }))} placeholder={t("form.pricePlaceholder")} className="h-12 text-base" /></Field>
        <Field label={t("form.visibility")} required><Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status }))}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{["Available", "Draft"].map((status) => <SelectItem key={status} value={status}>{status === "Available" ? t("form.visibilityAvailable") : t("form.visibilityDraft")}</SelectItem>)}</SelectContent></Select></Field>
      </Section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
      <StickyActionBar
        hint={valid ? t("form.hintReady", { animals: t("animals", { count: animalTotal }) }) : attempted ? t("form.hintStillNeeded", { items: missing.join(", ") }) : t("form.hintRemaining", { count: missing.length })}
        hintTone={valid ? "success" : attempted ? "danger" : "muted"}
      >
        <Button onClick={submit} disabled={submitting} className="h-12 w-full rounded-2xl text-base font-semibold">{submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{editing ? t("form.saveChanges") : t("form.saveListing")}</Button>
      </StickyActionBar>
    </div>
  );
}

function Section({ title, children }) { return <section className="soft-card mt-5 space-y-4 rounded-[1.5rem] p-4 sm:p-5"><h2 className="border-b border-border/60 pb-3 text-base font-extrabold">{title}</h2>{children}</section>; }
function Field({ label, required = false, error = "", children }) { return <div className="space-y-1.5"><Label className="text-sm font-semibold">{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>{children}{error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}</div>; }
function CountSummary({ label, value }) { return <div className="rounded-2xl bg-muted/55 p-3 text-center"><p className="text-xl font-extrabold text-primary">{value}</p><p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>; }
