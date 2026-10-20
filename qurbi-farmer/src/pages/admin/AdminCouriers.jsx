import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { courierApi } from "@/api/apiClient";
import StatusBadge from "@/components/agri/StatusBadge";
import EmptyState from "@/components/agri/EmptyState";
import AdminAccountCard from "@/components/agri/AdminAccountCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, BadgeDollarSign, Bike, MapPin } from "lucide-react";
import { AdminPageHeader, FilterChips, ListSkeleton, ResultCount, SearchField } from "@/components/admin/AdminUi";
import { courierStandingInfo, formatPrice } from "@/components/admin/adminFormat";

// "rate" is not a verification state: it surfaces approved couriers whose proposed
// delivery fee is waiting for an admin decision.
const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending review", attention: true },
  { value: "rate", label: "Rate requests", attention: true },
  { value: "approved", label: "Approved" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "unverified", label: "Not submitted" },
];
const SORT_ORDER = { pending: 0, rejected: 1, suspended: 2, unverified: 3, approved: 4 };

const hasRateRequest = (courier) => courier.rateStatus === "pending";

export default function AdminCouriers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filterParam = searchParams.get("status") || "all";
  const filter = FILTERS.some((item) => item.value === filterParam) ? filterParam : "all";

  const load = () => {
    setLoading(true);
    setError("");
    courierApi.adminList({ page: 1, limit: 100 })
      .then((page) => setCouriers(page.data || []))
      .catch((loadError) => setError(loadError.message || "Couriers could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setFilter = (value) => setSearchParams(value === "all" ? {} : { status: value }, { replace: true });

  const sorted = useMemo(
    () => [...couriers].sort((a, b) => (SORT_ORDER[a.verificationStatus] ?? 9) - (SORT_ORDER[b.verificationStatus] ?? 9)),
    [couriers],
  );

  const counts = useMemo(() => {
    const result = { all: couriers.length, rate: couriers.filter(hasRateRequest).length };
    couriers.forEach((courier) => { result[courier.verificationStatus] = (result[courier.verificationStatus] || 0) + 1; });
    return result;
  }, [couriers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted.filter((courier) => {
      const matchesFilter = filter === "all" || (filter === "rate" ? hasRateRequest(courier) : courier.verificationStatus === filter);
      const haystack = `${courier.user?.fullName || ""} ${courier.user?.email || ""} ${courier.vehiclePlate || ""} ${(courier.serviceAreas || []).map((area) => area.state).join(" ")}`.toLowerCase();
      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [sorted, filter, search]);

  const chipOptions = FILTERS
    .filter((item) => !["unverified", "suspended", "rejected"].includes(item.value) || counts[item.value] || filter === item.value)
    .map((item) => ({ ...item, count: counts[item.value] || 0 }));
  const activeLabel = FILTERS.find((item) => item.value === filter)?.label.toLowerCase();

  return (
    <div className="animate-fade-in">
      <AdminPageHeader eyebrow="Account management" title="Couriers" description="Approve new couriers, review their delivery rates and manage who can take jobs." />

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips label="Filter couriers by status" options={chipOptions} value={filter} onChange={setFilter} />
        <SearchField id="courier-search" label="Search couriers" value={search} onChange={setSearch} placeholder="Search name, email, plate or state" disabled={loading} className="lg:w-80" />
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-destructive">Couriers could not be loaded</p><p className="mt-0.5 text-sm text-muted-foreground">{error}</p></div>
          <Button variant="outline" onClick={load}>Try again</Button>
        </div>
      )}

      <div className="mb-3 mt-5">{!loading && !error && <ResultCount shown={filtered.length} total={couriers.length} noun="courier" />}</div>
      {loading ? <ListSkeleton /> : error ? null : filtered.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((courier) => {
            const info = courierStandingInfo(courier.verificationStatus);
            const needsAttention = courier.verificationStatus === "pending" || hasRateRequest(courier);
            const areas = (courier.serviceAreas || []).map((area) => area.state).join(", ");
            return (
              <AdminAccountCard
                key={courier.id}
                name={courier.user?.fullName || "Unnamed courier"}
                email={courier.user?.email}
                subtitle={`${courier.vehicleType || "Vehicle"} · ${courier.vehiclePlate || "No plate"}`}
                badge={<StatusBadge tone={info.tone} dot className="shrink-0">{info.label}</StatusBadge>}
                attention={needsAttention}
                ctaLabel={courier.verificationStatus === "pending" ? "Review documents" : "Review delivery rate"}
                onClick={() => navigate(`/admin/couriers/${courier.id}`)}
                meta={[
                  { icon: MapPin, label: "Service area", value: areas || "No service area" },
                  { icon: Bike, label: "Deliveries", value: `${courier.totalDeliveries || 0} delivered` },
                  ...(hasRateRequest(courier) ? [{ icon: BadgeDollarSign, label: "Rate request", value: `Asks ${formatPrice(courier.proposedFee)} per delivery` }] : []),
                ]}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bike}
          title={search ? "No matching couriers" : filter === "all" ? "No couriers yet" : filter === "pending" ? "No couriers waiting for review" : `No ${activeLabel}`}
          description={search ? "Try a different name, email, plate or state." : filter === "pending" ? "All caught up. New courier sign-ups will appear here." : "Couriers appear here after they register."}
          action={(search || filter !== "all") ? <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>Show all couriers</Button> : null}
        />
      )}
    </div>
  );
}
