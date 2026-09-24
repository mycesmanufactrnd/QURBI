import React, { useEffect, useState } from "react";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import StatusBadge from "@/components/agri/StatusBadge";
import { cn } from "@/lib/utils";

export default function AdminSpecies() {
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      qurbi.entities.SpeciesRequest.list("-created_date", 500),
      qurbi.entities.Species.list("name", 500),
    ]).then(([requestRows, speciesRows]) => {
      setRequests(requestRows || []);
      setSpecies(speciesRows || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const review = async () => {
    if (!decision?.request || !reason.trim()) return;
    const { request, approved } = decision;
    setProcessing(request.id);
    try {
      await qurbi.entities.SpeciesRequest.update(request.id, {
        status: approved ? "Approved" : "Rejected",
        adminReason: reason.trim(),
        reviewedBy: user?.id || "",
        reviewedAt: new Date().toISOString(),
      });
      await qurbi.entities.FarmerNotification.create({
        farmerId: request.farmerId,
        type: approved ? "Species Approved" : "Species Rejected",
        title: approved ? "New species approved" : "Species request needs correction",
        message: approved
          ? `${request.proposedName} was approved. Reason: ${reason.trim()} You can now select or request its breed.`
          : `${request.proposedName} was rejected. Reason: ${reason.trim()} Please edit the livestock and select or request another species.`,
        livestockId: request.livestockId || "",
        speciesRequestId: request.id,
        isRead: false,
      }).catch(() => {});
      setDecision(null);
      setReason("");
      load();
    } catch (error) {
      alert(error.message || "Species review failed.");
    } finally {
      setProcessing("");
    }
  };

  const toggleSpecies = async (item) => {
    setProcessing(item.id);
    try {
      const status = item.status === "Inactive" ? "Active" : "Inactive";
      await qurbi.entities.Species.update(item.id, { status });
      setSpecies((current) => current.map((speciesItem) => speciesItem.id === item.id ? { ...speciesItem, status } : speciesItem));
    } finally {
      setProcessing("");
    }
  };

  const pending = requests.filter((request) => request.status === "Pending");
  const history = requests.filter((request) => request.status !== "Pending");
  const shownRequests = tab === "pending" ? pending : history;

  return (
    <div className="animate-fade-in">
      <div><h1 className="text-xl font-extrabold tracking-tight">Species Management</h1><p className="text-xs text-muted-foreground">Review farmer requests and maintain approved species.</p></div>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        <Tab active={tab === "pending"} onClick={() => setTab("pending")}>Pending ({pending.length})</Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}>History ({history.length})</Tab>
        <Tab active={tab === "master"} onClick={() => setTab("master")}>Species list ({species.length})</Tab>
      </div>

      <div className="mt-4">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : tab === "master" ? (
          species.length ? <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">{species.map((item) => <div key={item.id} className="flex items-center gap-3 p-3.5"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.status}</p></div><Button variant="outline" size="sm" onClick={() => toggleSpecies(item)} disabled={processing === item.id}>{item.status === "Inactive" ? "Activate" : "Deactivate"}</Button></div>)}</div>
          : <EmptyState icon={CowSilhouetteIcon} title="No managed species" description="Cow, Goat and Sheep remain available as built-in options." />
        ) : shownRequests.length ? <div className="grid gap-3 lg:grid-cols-2">{shownRequests.map((request) => <div key={request.id} className="overflow-hidden rounded-2xl border border-border bg-card">{request.referenceImage && <a href={request.referenceImage} target="_blank" rel="noreferrer" title="Open full image" className="flex h-52 w-full items-center justify-center border-b border-border bg-muted/40 p-3"><img src={request.referenceImage} alt={request.proposedName} className="h-full w-full object-contain" /></a>}<div className="p-4"><div className="flex items-center justify-between gap-2"><p className="font-extrabold">{request.proposedName}</p><StatusBadge tone={request.status === "Pending" ? "warning" : request.status === "Approved" ? "success" : "danger"} dot>{request.status}</StatusBadge></div>{request.description && <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>}{request.adminReason && <div className="mt-3 rounded-xl bg-muted p-3"><p className="text-[11px] font-bold text-muted-foreground">Admin reason</p><p className="mt-1 text-sm">{request.adminReason}</p></div>}{request.status === "Pending" && <div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => { setDecision({ request, approved: true }); setReason(""); }} disabled={processing === request.id}><Check className="mr-1.5 h-4 w-4" />Approve</Button><Button variant="outline" className="text-destructive" onClick={() => { setDecision({ request, approved: false }); setReason(""); }} disabled={processing === request.id}><X className="mr-1.5 h-4 w-4" />Reject</Button></div>}</div></div>)}</div>
        : <EmptyState icon={CowSilhouetteIcon} title={tab === "pending" ? "No pending species requests" : "No species review history"} description="Species requests will appear here." />}
      </div>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) { setDecision(null); setReason(""); } }}>
        <DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>{decision?.approved ? "Approve" : "Reject"} {decision?.request?.proposedName}</DialogTitle></DialogHeader><div className="space-y-3"><Label>Reason shown to farmer *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain this decision..." /><Button onClick={review} disabled={!reason.trim() || processing === decision?.request?.id} variant={decision?.approved ? "default" : "destructive"} className="w-full">Confirm {decision?.approved ? "approval" : "rejection"}</Button></div></DialogContent>
      </Dialog>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{children}</button>;
}
