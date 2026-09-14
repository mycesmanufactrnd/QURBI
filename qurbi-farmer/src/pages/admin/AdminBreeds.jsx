import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import StatusBadge from "@/components/agri/StatusBadge";
import { marketplaceVisibility, speciesOptions } from "@/lib/agri";
import { cn } from "@/lib/utils";

export default function AdminBreeds() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("requests");
  const [requests, setRequests] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [approving, setApproving] = useState(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.BreedRequest.list("-created_date", 500),
      base44.entities.Breed.list("name", 500),
    ]).then(([requestRows, breedRows]) => {
      setRequests(requestRows || []);
      setBreeds(breedRows || []);
    }).finally(() => setLoading(false));
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

  const linkedLivestock = (request) => base44.entities.Livestock.filter({ breedRequestId: request.id }, "-created_date", 500);

  const notify = (request, type, title, message, livestockId = "") =>
    base44.entities.FarmerNotification.create({
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
      let breed = breeds.find((item) => item.species === request.species && item.name.toLowerCase() === request.proposedName.toLowerCase());
      if (!breed) {
        breed = await base44.entities.Breed.create({
          species: request.species,
          name: request.proposedName,
          image: request.referenceImage,
          description: request.description || "",
          status: "Active",
          sourceRequestId: request.id,
        });
      }
      const listings = await linkedLivestock(request);
      await Promise.all((listings || []).map((listing) => {
        const updated = { ...listing, breed: breed.name, breedId: breed.id, breedApprovalStatus: "Approved" };
        const visibility = marketplaceVisibility(updated);
        return base44.entities.Livestock.update(listing.id, {
          breed: breed.name,
          breedId: breed.id,
          breedApprovalStatus: "Approved",
          marketplaceVisible: visibility.visible,
          marketplaceVisibilityReason: visibility.reason,
        });
      }));
      await base44.entities.BreedRequest.update(request.id, {
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
        listings?.[0]?.id || request.livestockId || ""
      ).catch(() => {});
      setApproving(null);
      setApprovalReason("");
      load();
    } catch (error) {
      alert(error.message || "Approval failed.");
    } finally {
      setProcessing("");
    }
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setProcessing(rejecting.id);
    try {
      const listings = await linkedLivestock(rejecting);
      await Promise.all((listings || []).map((listing) => base44.entities.Livestock.update(listing.id, {
        breed: "Unspecified",
        breedId: "",
        breedApprovalStatus: "Rejected",
        marketplaceVisible: false,
        marketplaceVisibilityReason: "Breed request was rejected",
      })));
      await base44.entities.BreedRequest.update(rejecting.id, {
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
        listings?.[0]?.id || rejecting.livestockId || ""
      ).catch(() => {});
      setRejecting(null);
      setReason("");
      load();
    } catch (error) {
      alert(error.message || "Rejection failed.");
    } finally {
      setProcessing("");
    }
  };

  const toggleBreed = async (breed) => {
    setProcessing(breed.id);
    try {
      const status = breed.status === "Inactive" ? "Active" : "Inactive";
      await base44.entities.Breed.update(breed.id, { status });
      setBreeds((current) => current.map((item) => item.id === breed.id ? { ...item, status } : item));
    } finally {
      setProcessing("");
    }
  };

  const pending = requests.filter((request) => request.status === "Pending");
  const history = requests.filter((request) => request.status !== "Pending");
  const shownRequests = tab === "requests" ? pending : history;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Breed Management</h1>
          <p className="text-xs text-muted-foreground">Review farmer requests and maintain dropdown options.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add breed</Button>
      </div>

      <div className="mt-4 flex gap-2">
        <Tab active={tab === "requests"} onClick={() => setTab("requests")}>Requests ({pending.length})</Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}>History ({history.length})</Tab>
        <Tab active={tab === "master"} onClick={() => setTab("master")}>Breed list ({breeds.length})</Tab>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : tab !== "master" ? (
          shownRequests.length ? <div className="grid gap-3 lg:grid-cols-2">
            {shownRequests.map((request) => (
              <div key={request.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {request.referenceImage && (
                  <a
                    href={request.referenceImage}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-52 w-full items-center justify-center border-b border-border bg-muted/40 p-3"
                    title="Open full image"
                  >
                    <img src={request.referenceImage} alt={request.proposedName} className="h-full w-full object-contain" />
                  </a>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div><p className="font-extrabold">{request.proposedName}</p><p className="text-xs text-muted-foreground">{request.species}</p></div>
                    <StatusBadge tone={request.status === "Pending" ? "warning" : request.status === "Approved" ? "success" : "danger"} dot>{request.status}</StatusBadge>
                  </div>
                  {request.description && <p className="mt-3 text-sm text-muted-foreground">{request.description}</p>}
                  {request.adminReason && <div className="mt-3 rounded-xl bg-muted p-3"><p className="text-[11px] font-bold text-muted-foreground">Admin reason</p><p className="mt-1 text-sm">{request.adminReason}</p></div>}
                  {request.status === "Pending" && <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button onClick={() => setApproving(request)} disabled={processing === request.id}><Check className="mr-1.5 h-4 w-4" /> Approve</Button>
                    <Button variant="outline" className="text-destructive" onClick={() => { setRejecting(request); setReason(""); }} disabled={processing === request.id}><X className="mr-1.5 h-4 w-4" /> Reject</Button>
                  </div>}
                </div>
              </div>
            ))}
          </div> : <EmptyState icon={CowSilhouetteIcon} title={tab === "requests" ? "No pending breed requests" : "No breed review history"} description="New farmer requests will appear here." />
        ) : breeds.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {breeds.map((breed) => (
              <div key={breed.id} className="flex items-center gap-3 p-3.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">{breed.image && <img src={breed.image} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{breed.name}</p><p className="text-xs text-muted-foreground">{breed.species}</p></div>
                <Button variant="outline" size="sm" onClick={() => toggleBreed(breed)} disabled={processing === breed.id}>{breed.status === "Inactive" ? "Activate" : "Deactivate"}</Button>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={CowSilhouetteIcon} title="No managed breeds" description="Built-in Malaysian options remain available. Add a record to extend the dropdown." />}
      </div>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) { setRejecting(null); setReason(""); } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Reject {rejecting?.proposedName}</DialogTitle></DialogHeader>
          <div className="space-y-3"><Label>Reason shown to farmer *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /><Button onClick={reject} disabled={!reason.trim() || processing === rejecting?.id} className="w-full" variant="destructive">Confirm rejection</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(approving)} onOpenChange={(open) => { if (!open) { setApproving(null); setApprovalReason(""); } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Approve {approving?.proposedName}</DialogTitle></DialogHeader>
          <div className="space-y-3"><Label>Reason shown to farmer *</Label><Textarea value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} rows={4} placeholder="Explain why this request is accepted..." /><Button onClick={() => approve(approving)} disabled={!approvalReason.trim() || processing === approving?.id} className="w-full">Confirm approval</Button></div>
        </DialogContent>
      </Dialog>

      <AddBreedDialog open={addOpen} onOpenChange={changeAddOpen} onCreated={(breed) => { setBreeds((current) => [...current, breed]); changeAddOpen(false); }} />
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={cn("rounded-full px-4 py-2 text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{children}</button>;
}

function AddBreedDialog({ open, onOpenChange, onCreated }) {
  const [species, setSpecies] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try {
      const breed = await base44.entities.Breed.create({ species, name: name.trim(), description: description.trim(), image: "", status: "Active", sourceRequestId: "" });
      onCreated(breed);
      setSpecies(""); setName(""); setDescription("");
    } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>Add breed to master list</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Species *</Label><Select value={species} onValueChange={setSpecies}><SelectTrigger><SelectValue placeholder="Select species" /></SelectTrigger><SelectContent>{speciesOptions().map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Breed name *</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
          <Button onClick={submit} disabled={!species || !name.trim() || submitting} className="w-full">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add breed</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
