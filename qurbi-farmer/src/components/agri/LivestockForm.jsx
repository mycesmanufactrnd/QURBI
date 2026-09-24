import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ChevronDown, Loader2, MapPin, RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/agri/ImageUploader";
import VideoUploader from "@/components/agri/VideoUploader";
import BreedSelector from "@/components/agri/BreedSelector";
import SpeciesSelector from "@/components/agri/SpeciesSelector";
import {
  GENDERS,
  FARMER_LISTING_STATUSES,
  MALAYSIA_STATES,
  formatAge,
  marketplaceEligibleFrom,
  marketplaceVisibility,
} from "@/lib/agri";
import { cn } from "@/lib/utils";

function todayForInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function legacyAge(initial) {
  const match = String(initial.age || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(year|month)/i);
  if (!match) return { value: "", unit: "Months" };
  return { value: match[1], unit: match[2].toLowerCase().startsWith("year") ? "Years" : "Months" };
}

const LivestockForm = forwardRef(function LivestockForm({
  initial = {},
  registeredState = "",
  onSubmit,
  submitting,
  submitLabel = "Save Listing",
  hideActions = false,
}, ref) {
  const previousAge = legacyAge(initial);
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
  });
  const [images, setImages] = useState(initial.images || []);
  const [videos, setVideos] = useState(initial.videos || []);
  const [cover, setCover] = useState(initial.coverImage || initial.images?.[0] || null);
  const [ageTouched, setAgeTouched] = useState(false);
  const [error, setError] = useState("");

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setFromInput = (key) => (event) => setValue(key, event.target.value);

  const preview = useMemo(() => {
    const ageRecordedAt = ageTouched ? todayForInput() : form.ageRecordedAt;
    const data = { ...form, ageRecordedAt };
    return { age: formatAge(data), visibility: marketplaceVisibility(data) };
  }, [form, ageTouched]);

  const validAge = form.ageInputMode === "Birth Date"
    ? Boolean(form.birthDate) && form.birthDate <= todayForInput()
    : form.ageValue !== "" && Number(form.ageValue) >= 0;
  const valid = Boolean(
    images.length && form.species && form.breed && validAge && form.gender &&
    form.state && form.price !== "" && Number(form.price) >= 0 && form.status
  );

  const submit = () => {
    setError("");
    if (!valid) {
      setError("Please complete all required fields, including at least one photo.");
      return;
    }

    const normalized = {
      ...form,
      ageValue: form.ageInputMode === "Age" ? Number(form.ageValue) : null,
      ageRecordedAt: ageTouched ? todayForInput() : form.ageRecordedAt,
      birthDate: form.ageInputMode === "Birth Date" ? form.birthDate : "",
      price: Number(form.price),
      images,
      videos,
      coverImage: cover || images[0] || null,
      farmLocation: form.state,
    };
    const visibility = marketplaceVisibility(normalized);
    onSubmit({
      ...normalized,
      age: formatAge(normalized),
      marketplaceVisible: visibility.visible,
      marketplaceVisibilityReason: visibility.reason,
      marketplaceEligibleFrom: marketplaceEligibleFrom(normalized),
    });
  };

  useImperativeHandle(ref, () => ({ submit }));

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

  return (
    <div className="lg:grid lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-8">
      <div className="mb-6 space-y-5 lg:sticky lg:top-6 lg:mb-0">
        <Section title="Photos & Video" step={1}>
          <div className="space-y-5">
            <Field label="Livestock photos" required>
              <ImageUploader value={images} cover={cover} onChange={(nextImages, nextCover) => { setImages(nextImages); setCover(nextCover); }} />
            </Field>
            <Field label="Livestock videos">
              <VideoUploader value={videos} onChange={setVideos} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="space-y-6">
        <Section title="Animal Details" step={2}>
          <div className="space-y-4">
            <Grid>
              <Field label="Species" required>
                <SpeciesSelector
                  value={form.species}
                  approvalStatus={form.speciesApprovalStatus}
                  requestId={form.speciesRequestId}
                  livestockId={initial.id}
                  onChange={changeSpecies}
                />
              </Field>
              <Field label="Gender" required>
                <Select value={form.gender} onValueChange={(value) => setValue("gender", value)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>{GENDERS.map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Grid>

            <Field label="Breed" required>
              {form.speciesApprovalStatus === "Pending" ? (
                <div className="space-y-2"><Input value="Unspecified" readOnly className="h-12 bg-muted" /><p className="text-xs text-muted-foreground">Choose or request a breed after the species is approved.</p></div>
              ) : <BreedSelector
                species={form.species}
                value={form.breed}
                approvalStatus={form.breedApprovalStatus}
                requestId={form.breedRequestId}
                livestockId={initial.id}
                onChange={(breedFields) => setForm((current) => ({ ...current, ...breedFields }))}
              />}
            </Field>

            <Grid>
              <Field label="Color">
                <Input value={form.color} onChange={setFromInput("color")} placeholder="e.g. Brown and white" className="h-12" />
              </Field>
              <Field label="State" required>
                <Select value={form.state} onValueChange={(value) => setValue("state", value)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Grid>

            {registeredState && (
              <div className="flex min-h-7 items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {form.state === registeredState ? "Using your registered farm state." : "Using a different state for this animal."}
                </span>
                {form.state !== registeredState && (
                  <button type="button" onClick={() => setValue("state", registeredState)} className="flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline">
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
            )}

            <Field label="Description">
              <Textarea value={form.description} onChange={setFromInput("description")} placeholder="Describe this animal..." rows={3} className="resize-none" />
            </Field>
          </div>
        </Section>

        <Section title="Age" step={3}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {["Birth Date", "Age"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setValue("ageInputMode", mode); setAgeTouched(true); }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                    form.ageInputMode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {mode === "Age" ? "Current age" : mode}
                </button>
              ))}
            </div>

            {form.ageInputMode === "Birth Date" ? (
              <Field label="Date of birth" required>
                <Input type="date" max={todayForInput()} value={form.birthDate} onChange={(event) => { setValue("birthDate", event.target.value); setAgeTouched(true); }} className="h-12" />
              </Field>
            ) : (
              <Grid>
                <Field label="Age" required>
                  <Input type="number" min="0" step="1" value={form.ageValue} onChange={(event) => { setValue("ageValue", event.target.value); setAgeTouched(true); }} className="h-12" />
                </Field>
                <Field label="Unit" required>
                  <Select value={form.ageUnit} onValueChange={(value) => { setValue("ageUnit", value); setAgeTouched(true); }}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Months">Months</SelectItem><SelectItem value="Years">Years</SelectItem></SelectContent>
                  </Select>
                </Field>
              </Grid>
            )}

            <p className="text-xs text-muted-foreground">Displayed age: <span className="font-semibold text-foreground">{preview.age}</span>. It updates automatically over time.</p>
          </div>
        </Section>

        <Section title="Price & Status" step={4}>
          <div className="space-y-4">
            <Field label="Fixed selling price (MYR)" required>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="number" min="0" step="0.01" value={form.price} onChange={setFromInput("price")} placeholder="0.00" className="h-12 pl-9" />
              </div>
            </Field>
            <Field label="Listing status" required>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FARMER_LISTING_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setValue("status", status)}
                    className={cn(
                      "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                      form.status === status ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        <div className="soft-card overflow-hidden rounded-[1.5rem]">
          <button type="button" onClick={() => setShowAdvanced((current) => !current)} className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/40">
            <span>
              <span className="block text-sm font-bold">Advanced Information</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Optional measurements, tag and feeding details</span>
            </span>
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showAdvanced && "rotate-180")} />
          </button>
          {showAdvanced && (
            <div className="animate-fade-in space-y-4 border-t border-border/60 px-5 pb-5 pt-4">
              <Grid>
                <Field label="Weight (kg)"><Input value={form.weight} onChange={setFromInput("weight")} className="h-12" /></Field>
                <Field label="Height (cm)"><Input value={form.height} onChange={setFromInput("height")} className="h-12" /></Field>
              </Grid>
              <Grid>
                <Field label="Body length (cm)"><Input value={form.bodyLength} onChange={setFromInput("bodyLength")} className="h-12" /></Field>
                <Field label="Chest girth (cm)"><Input value={form.chestGirth} onChange={setFromInput("chestGirth")} className="h-12" /></Field>
              </Grid>
              <Grid>
                <Field label="Tag number"><Input value={form.tagNumber} onChange={setFromInput("tagNumber")} className="h-12" /></Field>
                <Field label="RFID number"><Input value={form.rfid} onChange={setFromInput("rfid")} className="h-12" /></Field>
              </Grid>
              <Field label="Feed / food given">
                <Textarea value={form.feedDetails} onChange={setFromInput("feedDetails")} placeholder="e.g. Napier grass, pellets and supplements" rows={2} className="resize-none" />
              </Field>
              <Field label="Special notes"><Textarea value={form.specialNotes} onChange={setFromInput("specialNotes")} rows={2} className="resize-none" /></Field>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!hideActions && (
          <Button onClick={submit} disabled={submitting} className="h-12 w-full rounded-2xl text-base font-semibold">
            {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
});

export default LivestockForm;

function Section({ title, step, children }) {
  return (
    <section className="soft-card rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">{step}</span>
        <h2 className="text-base font-extrabold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
