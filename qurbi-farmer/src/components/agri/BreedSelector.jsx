import React, { useEffect, useRef, useState } from "react";
import { useLivestockDisplay } from "@/lib/livestockDisplay";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { breedsFor } from "@/lib/agri";

export default function BreedSelector({ species, value, approvalStatus, requestId, livestockId, onChange }) {
  const { user } = useAuth();
  const { t, breed: breedLabel } = useLivestockDisplay();
  const [managedBreeds, setManagedBreeds] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    qurbi.entities.Breed.list("name", 500)
      .then((rows) => setManagedBreeds(rows || []))
      .catch(() => setManagedBreeds([]));
  }, []);

  const pending = approvalStatus === "Pending" && Boolean(requestId);
  const options = breedsFor(species, managedBreeds);

  const selectBreed = (name) => {
    const managed = managedBreeds.find((breed) => breed.species === species && breed.name === name);
    onChange({
      breed: name,
      breedId: managed?.id || "",
      breedRequestId: "",
      breedApprovalStatus: name === "Unspecified" ? "Unspecified" : "Approved",
    });
  };

  if (pending) {
    return (
      <div className="space-y-2">
        <Input value={breedLabel(value)} readOnly className="h-12 bg-muted" />
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("breedSelector.pendingNote")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={selectBreed} disabled={!species}>
        <SelectTrigger className="h-12"><SelectValue placeholder={t("breedSelector.placeholder")} /></SelectTrigger>
        <SelectContent>
          {options.map((breed) => <SelectItem key={breed} value={breed}>{breedLabel(breed)}</SelectItem>)}
        </SelectContent>
      </Select>

      {value === "Unspecified" && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3">
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("breedSelector.unspecifiedWarning")}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> {t("breedSelector.addNew")}
          </Button>
        </div>
      )}

      {approvalStatus === "Rejected" && (
        <p className="text-xs text-destructive">{t("breedSelector.rejectedNote")}</p>
      )}

      <BreedRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        species={species}
        farmerId={user?.id}
        livestockId={livestockId}
        onCreated={(request) => {
          onChange({
            breed: request.proposedName,
            breedId: "",
            breedRequestId: request.id,
            breedApprovalStatus: "Pending",
          });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function BreedRequestDialog({ open, onOpenChange, species, farmerId, livestockId, onCreated }) {
  const { t, species: speciesLabel } = useLivestockDisplay();
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await qurbi.integrations.Core.UploadFile({ file });
      setImage(result.file_url);
    } catch (uploadError) {
      setError(uploadError.message || t("breedSelector.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !image || !species || !farmerId) return;
    setSubmitting(true);
    setError("");
    try {
      const request = await qurbi.entities.BreedRequest.create({
        farmerId,
        livestockId: livestockId || "",
        species,
        proposedName: name.trim(),
        referenceImage: image,
        description: description.trim(),
        status: "Pending",
      });
      onCreated(request);
      setName("");
      setDescription("");
      setImage("");
    } catch (requestError) {
      setError(requestError.message || t("breedSelector.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>{species ? t("breedSelector.dialogTitle", { species: speciesLabel(species).toLowerCase() }) : t("breedSelector.dialogTitleGeneric")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("breedSelector.nameLabel")}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("breedSelector.namePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("breedSelector.referenceImage")}</Label>
            {image ? (
              <div className="relative h-40 overflow-hidden rounded-2xl border border-border bg-muted">
                <img src={image} alt={t("breedSelector.referenceAlt")} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setImage("")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="mt-1 text-xs">{uploading ? t("breedSelector.uploading") : t("breedSelector.uploadImage")}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0])} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("breedSelector.descriptionLabel")}</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>
          <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" /> {t("breedSelector.canStillSave")}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="button" onClick={submit} disabled={!name.trim() || !image || uploading || submitting} className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("breedSelector.submitReview")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
