import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { qurbi } from "@/api/qurbiClient";
import { resolveApiAssetUrl } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, Check, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import StatusBadge from "@/components/agri/StatusBadge";
import ConfirmDialog from "@/components/agri/ConfirmDialog";
import { speciesOptions } from "@/lib/agri";
import { cn } from "@/lib/utils";
import { AdminPageHeader, FilterChips, ListSkeleton, ResultCount, SearchField } from "@/components/admin/AdminUi";
import { formatDate } from "@/components/admin/adminFormat";

const TABS = ["requests", "history", "master"];
const REQUEST_TONE = { Pending: "warning", Approved: "success", Rejected: "danger" };
const REQUEST_LABEL = { Pending: "Waiting for review", Approved: "Approved", Rejected: "Rejected" };

export default function AdminBreeds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "requests"));
  const [requests, setRequests] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processing, setProcessing] = useState("");
  const [approving, setApproving] = useState(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [breedSearch, setBreedSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");

  const load = () => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      qurbi.entities.BreedRequest.list("-created_date", 500),
      qurbi.entities.Breed.list("name", 500),
    ]).then(([requestRows, breedRows]) => {
      setRequests(requestRows || []);
      setBreeds(breedRows || []);
    }).catch((error) => setLoadError(error.message || "Breeds could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setTab("master");
      setAddOpen(true);
    }
  }, [searchParams]);

  const changeAddOpen = (open) => {
    setAddOpen(open);
    if (!open && searchParams.get("action") === "add") setSearchParams({}, { replace: true });
  };

  const notify = (request, type, title, message, livestockId = "") =>
    qurbi.entities.FarmerNotification.create({
      farmerId: request.farmerId,
      type,
      title,
      message,
      livestockId,
      breedRequestId: request.id,
      isRead: false,
    });

  const approve = async (request) => {
    if (!approvalReason.trim()) return;
    setProcessing(request.id);
    try {
      await qurbi.entities.BreedRequest.update(request.id, {
        status: "Approved",
        adminReason: approvalReason.trim(),
        reviewedBy: user?.id || "",
        reviewedAt: new Date().toISOString(),
      });
      await notify(
        request,
        "Breed Approved",
        "New breed approved",
        `${request.proposedName} has been approved and added to the ${request.species} breed list. Admin reason: ${approvalReason.trim()}`,
        request.livestockId || ""
      ).catch(() => {});
      setApproving(null);
      setApprovalReason("");
      toast({ title: `${request.proposedName} approved`, description: "It is now in the breed list and the farmer has been notified." });
      load();
    } catch (error) {
      toast({ variant: "destructive", title: "Approval failed", description: error.message || "Please try again." });
    } finally {
      setProcessing("");
    }
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setProcessing(rejecting.id);
    try {
      await qurbi.entities.BreedRequest.update(rejecting.id, {
        status: "Rejected",
        adminReason: reason.trim(),
        reviewedBy: user?.id || "",
        reviewedAt: new Date().toISOString(),
      });
      await notify(
        rejecting,
        "Breed Rejected",
        "Breed request needs correction",
        `${rejecting.proposedName} was rejected. Reason: ${reason.trim()} Your other livestock details remain saved; please choose or request another breed.`,
        rejecting.livestockId || ""
      ).catch(() => {});
      toast({ title: `${rejecting.proposedName} rejected`, description: "The farmer has been notified with your reason." });
      setRejecting(null);
      setReason("");
      load();
    } catch (error) {
      toast({ variant: "destructive", title: "Rejection failed", description: error.message || "Please try again." });
    } finally {
      setProcessing("");
    }
  };

  const toggleBreed = async (breed) => {
    setProcessing(breed.id);
    try {
      const status = breed.status === "Inactive" ? "Active" : "Inactive";
      await qurbi.entities.Breed.update(breed.id, { status });
      setBreeds((current) => current.map((item) => item.id === breed.id ? { ...item, status } : item));
      setConfirmDeactivate(null);
      toast({ title: status === "Active" ? `${breed.name} activated` : `${breed.name} deactivated`, description: status === "Active" ? "Farmers can choose it again." : "Farmers can no longer choose it for new listings." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not update breed", description: error.message || "Please try again." });
    } finally {
      setProcessing("");
    }
  };

  const pending = requests.filter((request) => request.status === "Pending");
  const history = requests.filter((request) => request.status !== "Pending");
  const shownRequests = tab === "requests" ? pending : history;
  const breedSpecies = [...new Set(breeds.map((breed) => breed.species).filter(Boolean))].sort();
  const shownBreeds = useMemo(() => {
    const term = breedSearch.trim().toLowerCase();
    return breeds.filter((breed) => (speciesFilter === "All" || breed.species === speciesFilter) && (!term || String(breed.name || "").toLowerCase().includes(term)));
  }, [breeds, breedSearch, speciesFilter]);

  const changeTab = (value) => {
    setTab(value);
    setSearchParams(value === "requests" ? {} : { tab: value }, { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        eyebrow="Marketplace management"
        title="Breeds"
        description="Review breeds proposed by farmers and manage the breed dropdown."
        actions={<Button onClick={() => setAddOpen(true)} className="px-4"><Plus className="h-4 w-4" /><span>Add breed</span></Button>}
      />

      <FilterChips
        className="mt-5"
        label="Breed sections"
        value={tab}
        onChange={changeTab}
        options={[
          { value: "requests", label: "Requests", count: pending.length, attention: true },
          { value: "history", label: "History", count: history.length },
          { value: "master", label: "Breed list", count: breeds.length },
        ]}
      />

      {loadError && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-destructive">Breeds could not be loaded</p><p className="mt-0.5 text-sm text-muted-foreground">{loadError}</p></div>
          <Button variant="outline" onClick={load}>Try again</Button>
        </div>
      )}

      <div className="mt-4">
        {loading ? <ListSkeleton rows={3} /> : loadError ? null : tab !== "master" ? (
          shownRequests.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
            {shownRequests.map((request) => (
              <div key={request.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {request.referenceImage && (
                  <a
                    href={resolveApiAssetUrl(request.referenceImage)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-52 w-full items-center justify-center border-b border-border bg-muted/40 p-3"
                    title="Open full image"
                  >
                    <img src={resolveApiAssetUrl(request.referenceImage)} alt={request.proposedName} className="h-full w-full object-contain" />
                  </a>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div><p className="font-extrabold">{request.proposedName}</p><p className="text-xs text-muted-foreground">{request.species}</p></div>
                    <StatusBadge tone={request.status === "Pending" ? "warning" : request.status === "Approved" ? "success" : "danger"} dot>{request.status}</StatusBadge>
                  </div>
                </div>
                {request.adminReason && <div className="mx-4 mb-4 rounded-xl bg-muted p-3"><p className="text-xs font-bold text-muted-foreground">Admin reason</p><p className="mt-1 text-sm">{request.adminReason}</p></div>}
                {request.status === "Pending" && <div className="grid grid-cols-2 gap-2 border-t border-border/70 bg-muted/20 p-3">
                  <Button variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => { setRejecting(request); setReason(""); }} disabled={processing === request.id}><X className="h-4 w-4" /> Reject</Button>
                  <Button onClick={() => setApproving(request)} disabled={processing === request.id}>{processing === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve breed</Button>
                </div>}
              </article>
            ))}
          </div> : (
            <EmptyState
              icon={CowSilhouetteIcon}
              title={tab === "requests" ? "No breed requests to review" : "No review history yet"}
              description={tab === "requests" ? "All caught up. When a farmer proposes a new breed it will appear here." : "Breed requests you approve or reject will be listed here."}
              action={<Button variant="outline" onClick={() => changeTab("master")}>View breed list</Button>}
            />
          )
        ) : breeds.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {breeds.map((breed) => (
              <div key={breed.id} className="flex items-center gap-3 p-3.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">{breed.image && <img src={resolveApiAssetUrl(breed.image)} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{breed.name}</p><p className="text-xs text-muted-foreground">{breed.species}</p></div>
                <Button variant="outline" size="sm" onClick={() => toggleBreed(breed)} disabled={processing === breed.id}>{breed.status === "Inactive" ? "Activate" : "Deactivate"}</Button>
              </div>
            ) : (
              <EmptyState icon={CowSilhouetteIcon} title="No matching breeds" description="Try another name or species." action={<Button variant="outline" onClick={() => { setBreedSearch(""); setSpeciesFilter("All"); }}>Clear filters</Button>} />
            )}
          </>
        ) : <EmptyState icon={CowSilhouetteIcon} title="No managed breeds" description="Built-in Malaysian options remain available. Add a record to extend the dropdown." action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Add breed</Button>} />}
      </div>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) { setRejecting(null); setReason(""); } }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
          <DialogHeader className="text-left">
            <DialogTitle>Reject {rejecting?.proposedName}?</DialogTitle>
            <DialogDescription>Linked listings go back to draft with breed &quot;Unspecified&quot;. The farmer is notified with your reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="breed-reject-reason">Reason shown to farmer <span className="text-destructive">*</span></Label><Textarea id="breed-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="e.g. This is the same as the existing Boer breed." /><p className="text-xs text-muted-foreground">Required.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }} disabled={processing === rejecting?.id}>Cancel</Button>
              <Button onClick={reject} disabled={!reason.trim() || processing === rejecting?.id} variant="destructive">{processing === rejecting?.id && <Loader2 className="h-4 w-4 animate-spin" />}Confirm rejection</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(approving)} onOpenChange={(open) => { if (!open) { setApproving(null); setApprovalReason(""); } }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
          <DialogHeader className="text-left">
            <DialogTitle>Approve {approving?.proposedName}?</DialogTitle>
            <DialogDescription>It will be added to the {approving?.species || ""} breed list and linked listings will be restored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="breed-approve-reason">Reason shown to farmer <span className="text-destructive">*</span></Label><Textarea id="breed-approve-reason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} rows={4} placeholder="Explain why this request is accepted..." /><p className="text-xs text-muted-foreground">Required.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setApproving(null); setApprovalReason(""); }} disabled={processing === approving?.id}>Cancel</Button>
              <Button onClick={() => approve(approving)} disabled={!approvalReason.trim() || processing === approving?.id}>{processing === approving?.id && <Loader2 className="h-4 w-4 animate-spin" />}Confirm approval</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        onOpenChange={(open) => { if (!open && !processing) setConfirmDeactivate(null); }}
        title={`Deactivate ${confirmDeactivate?.name || "breed"}?`}
        description="Farmers will no longer be able to choose this breed for new listings. Existing listings keep it. You can activate it again at any time."
        confirmText="Deactivate"
        destructive
        loading={Boolean(confirmDeactivate && processing === confirmDeactivate.id)}
        onConfirm={() => confirmDeactivate && toggleBreed(confirmDeactivate)}
      />

      <AddBreedDialog
        open={addOpen}
        onOpenChange={changeAddOpen}
        onCreated={(breed) => {
          setBreeds((current) => [...current, breed]);
          changeAddOpen(false);
          changeTab("master");
          toast({ title: `${breed.name} added`, description: "Farmers can now choose it from the breed dropdown." });
        }}
      />
    </div>
  );
}

function AddBreedDialog({ open, onOpenChange, onCreated }) {
  const [species, setSpecies] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event?.preventDefault();
    if (!species || !name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const breed = await qurbi.entities.Breed.create({ species, name: name.trim(), description: description.trim(), image: "", status: "Active", sourceRequestId: "" });
      onCreated(breed);
      setSpecies(""); setName(""); setDescription("");
    } catch (createError) {
      setError(createError.message || "The breed could not be added.");
    } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!submitting) { setError(""); onOpenChange(value); } }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Add breed to master list</DialogTitle>
          <DialogDescription>Farmers will see it in the breed dropdown for the chosen species.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5"><Label htmlFor="new-breed-species">Species <span className="text-destructive">*</span></Label><Select value={species} onValueChange={setSpecies}><SelectTrigger id="new-breed-species" className="h-11"><SelectValue placeholder="Select species" /></SelectTrigger><SelectContent>{speciesOptions().map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="new-breed-name">Breed name <span className="text-destructive">*</span></Label><Input id="new-breed-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="e.g. Brahman" /></div>
          <div className="space-y-1.5"><Label htmlFor="new-breed-description">Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label><Textarea id="new-breed-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
          {error && <p className="flex items-start gap-2 rounded-xl bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          <Button type="submit" disabled={!species || !name.trim() || submitting} className="w-full">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Add breed</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
