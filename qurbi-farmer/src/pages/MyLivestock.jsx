import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Boxes, Plus } from "lucide-react";
import LivestockCard from "@/components/agri/LivestockCard";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import ConfirmDialog from "@/components/agri/ConfirmDialog";
import { listingExpiry, LIVESTOCK_STATUSES } from "@/lib/agri";
import { cn } from "@/lib/utils";
import { refreshExpiredReservations } from "@/lib/livestockReservation";

export default function MyLivestock() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.Livestock.list("-created_date", 100)
      .then((d) => refreshExpiredReservations(d || []))
      .then((d) => setItems(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "All"
    ? items
    : filter === "Expired"
      ? items.filter((i) => i.status === "Available" && listingExpiry(i).expired)
      : filter === "Available"
        ? items.filter((i) => i.status === "Available" && !listingExpiry(i).expired)
        : items.filter((i) => i.status === filter);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Livestock.delete(toDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      alert(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">My Livestock</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage individual animal listings and availability.</p>
        </div>
        <button onClick={() => navigate("/livestock/add")} aria-label="Add livestock" className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-[0_4px_12px_rgba(65,54,45,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <button onClick={() => navigate("/bulk")} className="soft-card mt-5 flex min-h-[72px] w-full items-center justify-between p-4 text-left transition-all hover:border-primary/20">
        <span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/70 text-primary"><Boxes className="h-5 w-5" /></span><span><strong className="block text-sm">Bulk Sell</strong><span className="block text-xs text-muted-foreground">Sell multiple animals in one listing</span></span></span>
        <span className="text-xs font-semibold text-primary">Open</span>
      </button>

      {/* Filter chips */}
      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        {["All", "Expired", ...LIVESTOCK_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors",
              filter === s ? "brand-gradient text-primary-foreground shadow-sm" : "bg-card text-muted-foreground ring-1 ring-border/70"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {!loading && <p className="mb-3 text-xs font-semibold text-muted-foreground">{filtered.length} {filter === "All" ? "total" : filter.toLowerCase()} listing{filtered.length === 1 ? "" : "s"}</p>}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.25rem] bg-muted" />)}
          </div>
        ) : filtered.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => (
              <LivestockCard
                key={l.id}
                livestock={l}
                statusPlacement="content"
                onEdit={(li) => navigate(`/livestock/${li.id}/edit`)}
                onDelete={(li) => setToDelete(li)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CowSilhouetteIcon}
            title={filter === "All" ? "No livestock yet" : `No ${filter.toLowerCase()} livestock`}
            description="Add your first animal to start selling on QURBI."
            action={<button onClick={() => navigate("/livestock/add")} className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Add Livestock</button>}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this listing?"
        description="This action cannot be undone."
        confirmText="Delete"
        destructive
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}
