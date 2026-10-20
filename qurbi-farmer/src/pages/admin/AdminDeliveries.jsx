import React, { useCallback, useEffect, useMemo, useState } from "react";
import { courierApi, courierJobApi } from "@/api/apiClient";
import { AlertCircle, Bike, Flag, MapPin, PackageCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import EmptyState from "@/components/agri/EmptyState";
import StatusBadge from "@/components/agri/StatusBadge";
import { AdminPageHeader, FilterChips, ListSkeleton, ResultCount } from "@/components/admin/AdminUi";
import DocumentThumb from "@/components/admin/DocumentThumb";
import { assignmentStatusInfo, formatDateTime, proofFlagLabel, titleCase } from "@/components/admin/adminFormat";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "attention", label: "Needs attention", attention: true },
  { value: "active", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "all", label: "All" },
];
const ACTIVE = ["accepted", "picked_up", "in_transit"];

const STAGE_LABEL = { pickup: "Pickup", transit: "On the road", delivery: "Handover", failed: "Problem report" };

function needsAttention(row) {
  return row.flags.length > 0 || (row.status === "failed" && !row.resolutionNote);
}

export default function AdminDeliveries() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("attention");
  const [expanded, setExpanded] = useState("");
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      courierJobApi.adminList(),
      courierApi.adminList({ status: "approved", page: 1, limit: 100 }),
    ]).then(([jobRows, courierPage]) => {
      setRows(jobRows || []);
      setCouriers(courierPage.data || []);
    }).catch((loadError) => setError(loadError.message || "Deliveries could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    attention: rows.filter(needsAttention).length,
    active: rows.filter((row) => ACTIVE.includes(row.status)).length,
    delivered: rows.filter((row) => row.status === "delivered").length,
    all: rows.length,
  }), [rows]);

  const visible = useMemo(() => rows.filter((row) => {
    if (filter === "attention") return needsAttention(row);
    if (filter === "active") return ACTIVE.includes(row.status);
    if (filter === "delivered") return row.status === "delivered";
    return true;
  }), [rows, filter]);

  const chipOptions = FILTERS.map((item) => ({ ...item, count: counts[item.value] }));

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        eyebrow="Fulfilment"
        title="Deliveries"
        description="Follow courier jobs, check flagged proof photos and decide what happens after a failed delivery."
        actions={<Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh deliveries" className="h-11 w-11 rounded-2xl"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>}
      />

      <div className="mt-5"><FilterChips label="Filter deliveries" options={chipOptions} value={filter} onChange={setFilter} /></div>

      {error && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-destructive">Deliveries could not be loaded</p><p className="mt-0.5 text-sm text-muted-foreground">{error}</p></div>
          <Button variant="outline" onClick={load}>Try again</Button>
        </div>
      )}

      <div className="mb-3 mt-5">{!loading && !error && <ResultCount shown={visible.length} total={rows.length} noun="delivery" />}</div>

      {loading ? <ListSkeleton /> : error ? null : visible.length ? (
        <div className="grid gap-3">
          {visible.map((row) => (
            <DeliveryCard
              key={row.id}
              row={row}
              open={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? "" : row.id)}
              onResolve={() => setDialog({ kind: "resolve", row })}
              onReassign={() => setDialog({ kind: "reassign", row })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackageCheck}
          title={filter === "attention" ? "Nothing needs attention" : "No deliveries here"}
          description={filter === "attention" ? "Flagged proof photos and failed deliveries will show up here." : "Courier jobs appear once a courier accepts an order."}
          action={filter !== "all" ? <Button variant="outline" onClick={() => setFilter("all")}>Show all deliveries</Button> : null}
        />
      )}

      <DecisionDialog dialog={dialog} couriers={couriers} onClose={() => setDialog(null)} onDone={(message) => { setDialog(null); toast({ title: message }); load(); }} />
    </div>
  );
}

function DeliveryCard({ row, open, onToggle, onResolve, onReassign }) {
  const info = assignmentStatusInfo(row.status);
  const failedOpen = row.status === "failed" && !row.resolutionNote;
  const proofEvents = (row.events || []).filter((event) => event.images?.length);
  return (
    <article className={cn("soft-card min-w-0 overflow-hidden", (row.flags.length > 0 || failedOpen) && "border-amber-300/80")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full min-w-0 items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Bike className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-extrabold">Order #{row.order.orderNumber}</span>
            <StatusBadge tone={info.tone} dot className="shrink-0">{info.label}</StatusBadge>
            {row.flags.length > 0 && <StatusBadge tone="warning" icon={Flag} className="shrink-0">{row.flags.length} flag{row.flags.length === 1 ? "" : "s"}</StatusBadge>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-foreground/75">{row.courier.name} · {row.courier.vehiclePlate}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Accepted {formatDateTime(row.acceptedAt)}{row.deliveredAt ? ` · Delivered ${formatDateTime(row.deliveredAt)}` : ""}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 p-4">
          {row.flags.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              {row.flags.map((flag) => <li key={flag} className="flex items-start gap-2"><Flag className="mt-0.5 h-4 w-4 shrink-0" />{proofFlagLabel(flag)}</li>)}
            </ul>
          )}
          {row.status === "failed" && (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
              <p className="font-extrabold text-destructive">{titleCase(row.failureCategory)}</p>
              <p className="mt-1 break-words">{row.failedReason}</p>
              {row.resolutionNote && <p className="mt-2 break-words text-muted-foreground"><span className="font-semibold">Decision: </span>{row.resolutionNote}</p>}
            </div>
          )}

          {proofEvents.length > 0 ? proofEvents.map((event) => (
            <section key={event.id} aria-label={STAGE_LABEL[event.stage] || "Proof"}>
              <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold">
                {STAGE_LABEL[event.stage] || titleCase(event.status)}
                <span className="text-xs font-medium text-muted-foreground">taken {formatDateTime(event.capturedAt)} · received {formatDateTime(event.serverReceivedAt)}</span>
              </h3>
              {event.latitude && (
                <a className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}>
                  <MapPin className="h-3.5 w-3.5" />{Number(event.latitude).toFixed(5)}, {Number(event.longitude).toFixed(5)}{event.accuracyMeters ? ` (±${event.accuracyMeters} m)` : ""}
                </a>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {event.images.map((url, index) => <DocumentThumb key={url} label={`Photo ${index + 1}`} url={url} />)}
              </div>
              {event.note && <p className="mt-2 break-words text-xs text-muted-foreground">{event.note}</p>}
            </section>
          )) : <p className="text-sm text-muted-foreground">No proof photos uploaded yet.</p>}

          {row.status === "failed" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" className="h-11" onClick={onReassign}>Assign another courier</Button>
              {!row.resolutionNote && <Button className="h-11" onClick={onResolve}>Record decision</Button>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DecisionDialog({ dialog, couriers, onClose, onDone }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [courierId, setCourierId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNote(""); setCourierId(""); }, [dialog]);

  if (!dialog) return null;
  const isResolve = dialog.kind === "resolve";
  const others = couriers.filter((courier) => courier.id !== dialog.row.courier.id);

  const submit = async () => {
    setBusy(true);
    try {
      if (isResolve) await courierJobApi.adminResolve(dialog.row.id, note.trim());
      else await courierJobApi.adminAssign(dialog.row.order.id, courierId);
      onDone(isResolve ? "Decision recorded" : "Courier assigned");
    } catch (error) {
      toast({ variant: "destructive", title: "That did not work", description: error.message || "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>{isResolve ? "Record your decision" : "Assign another courier"}</DialogTitle>
          <DialogDescription>
            {isResolve
              ? `Order #${dialog.row.order.orderNumber}: note what you decided (for example a rescheduled delivery or a refund) so the team can see it.`
              : `Order #${dialog.row.order.orderNumber} keeps its current status. The new courier takes over from where it is.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isResolve ? (
            <div className="space-y-1.5">
              <Label htmlFor="resolve-note">Decision <span className="text-destructive">*</span></Label>
              <Textarea id="resolve-note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Buyer reached by phone, redelivery booked for tomorrow." />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="assign-courier">Approved courier</Label>
              <select id="assign-courier" value={courierId} onChange={(event) => setCourierId(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Choose a courier…</option>
                {others.map((courier) => <option key={courier.id} value={courier.id}>{courier.user?.fullName} · {courier.vehiclePlate}{courier.isOnline ? " · online" : ""}</option>)}
              </select>
              {!others.length && <p className="text-xs text-muted-foreground">No other approved couriers yet.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || (isResolve ? !note.trim() : !courierId)}>{isResolve ? "Save decision" : "Assign courier"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
