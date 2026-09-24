import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { qurbi } from "@/api/qurbiClient";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import LivestockCard from "@/components/agri/LivestockCard";
import { Loader2, Ban, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIVESTOCK_STATUSES, malaysiaState } from "@/lib/agri";
import { cn } from "@/lib/utils";

export default function AdminLivestock() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [breedFilter, setBreedFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");

  const load = () => {
    setLoading(true);
    qurbi.entities.Livestock.list("-created_date", 200)
      .then((d) => setItems(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const breeds = [...new Set(items.map((item) => item.breed).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = items.filter((item) =>
    (statusFilter === "All" || item.status === statusFilter) &&
    (breedFilter === "All" || item.breed === breedFilter) &&
    (genderFilter === "All" || item.gender === genderFilter)
  );

  const toggleDisable = async (item) => {
    setToggling(item.id);
    try {
      let state = malaysiaState(item.state, item.farmLocation);
      if (!state && item.ownerId) {
        const profiles = await qurbi.entities.FarmerProfile.filter({ userId: item.ownerId }, "-created_date", 1);
        state = malaysiaState(profiles?.[0]?.state);
      }
      if (!state) throw new Error("This listing has no state. Ask the farmer to update the livestock location first.");

      const update = { disabled: !item.disabled, state };
      await qurbi.entities.Livestock.update(item.id, update);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...update } : i)));
    } catch (err) {
      alert(err.message || "Failed to update");
    } finally {
      setToggling(null);
    }
  };

  const resetFilters = () => {
    setStatusFilter("All");
    setBreedFilter("All");
    setGenderFilter("All");
  };

  return (
    <div className="animate-fade-in">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Marketplace management</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight lg:text-3xl">All Livestock</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review every farmer listing and control marketplace visibility.</p>
      </div>

      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        {["All", ...LIVESTOCK_STATUSES].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
              statusFilter === status ? "brand-gradient text-primary-foreground shadow-sm" : "bg-card text-muted-foreground ring-1 ring-border/70",
            )}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="soft-card mt-4 p-3.5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground"><SlidersHorizontal className="h-4 w-4 text-primary" />Refine listings</div>
        <div className="grid grid-cols-2 gap-2.5">
          <Select value={breedFilter} onValueChange={setBreedFilter}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All breeds</SelectItem>{breeds.map((breed) => <SelectItem key={breed} value={breed}>{breed}</SelectItem>)}</SelectContent></Select>
          <Select value={genderFilter} onValueChange={setGenderFilter}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All genders</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select>
        </div>
      </div>

      <div className="mt-5">
        {!loading && <p className="mb-3 text-xs font-semibold text-muted-foreground">Showing {filtered.length} of {items.length} listing{items.length === 1 ? "" : "s"}</p>}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-[1.25rem] bg-muted" />)}
          </div>
        ) : filtered.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((livestock) => (
              <LivestockCard
                key={livestock.id}
                livestock={livestock}
                actions={false}
                statusPlacement="content"
                onView={(item) => navigate(`/admin/livestock/${item.id}`)}
                footerActions={<>
                  <button type="button" onClick={() => navigate(`/admin/livestock/${livestock.id}`)} className="brand-gradient flex min-h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-bold text-white shadow-[0_4px_12px_rgba(65,54,45,0.14)]">View details</button>
                  <button type="button" onClick={() => toggleDisable(livestock)} disabled={toggling === livestock.id} aria-label={livestock.disabled ? "Enable listing" : "Disable listing"} title={livestock.disabled ? "Enable listing" : "Disable listing"} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors", livestock.disabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
                    {toggling === livestock.id ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : livestock.disabled ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Ban className="h-[18px] w-[18px]" />}
                  </button>
                </>}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={CowSilhouetteIcon} title="No livestock found" description="No listings match the selected status, breed and gender." action={<button type="button" onClick={resetFilters} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Clear filters</button>} />
        )}
      </div>
    </div>
  );
}
