import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { farmerProfileApi, userApi } from "@/api/apiClient";
import StatusBadge from "@/components/agri/StatusBadge";
import EmptyState from "@/components/agri/EmptyState";
import AdminAccountCard from "@/components/agri/AdminAccountCard";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, MapPin, Search, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Pending", "Approved", "Rejected"];
const TONE = { Pending: "warning", Approved: "success", Rejected: "danger", "Not Submitted": "muted" };

export default function AdminFarmers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      userApi.list({ role: "farmer", page: 1, limit: 100 }),
      farmerProfileApi.list(),
    ]).then(([userPage, profileRows]) => {
      setUsers(userPage.data || []);
      setProfiles(profileRows || []);
    }).finally(() => setLoading(false));
  }, []);

  const profileMap = {};
  profiles.forEach((profile) => { profileMap[profile.userId] = profile; });
  const farmers = users.filter((user) => Boolean(profileMap[user.id]));
  const filtered = useMemo(() => farmers.filter((farmer) => {
    const profile = profileMap[farmer.id];
    const status = statusLabel(profile?.verificationStatus);
    const name = farmer.fullName || "Unnamed farmer";
    const term = search.trim().toLowerCase();
    const matchesFilter = filter === "All" || status === filter;
    const matchesSearch = !term || `${name} ${farmer.email || ""} ${profile?.farmName || ""}`.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  }), [farmers, filter, profileMap, search]);

  return (
    <div className="animate-fade-in">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Account management</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Farmer Accounts</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Review registration status and open each farmer profile.</p>
      </div>

      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        {FILTERS.map((status) => {
          const count = status === "All" ? farmers.length : farmers.filter((farmer) => statusLabel(profileMap[farmer.id]?.verificationStatus) === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-bold transition-colors",
                filter === status ? "brand-gradient text-primary-foreground shadow-sm" : "bg-card text-muted-foreground ring-1 ring-border/70",
              )}
            >
              {status}
              <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold", filter === status ? "bg-white/15 text-white" : "bg-muted text-foreground")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <label htmlFor="farmer-search" className="mb-2 block text-xs font-bold text-foreground">Find a farmer</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="farmer-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or farm" className="h-12 rounded-2xl bg-card pl-10" disabled={loading} />
        </div>
      </div>

      {!loading && <p className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">Showing {filtered.length} farmer account{filtered.length === 1 ? "" : "s"}</p>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading ? <div className="col-span-full flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : filtered.length ? filtered.map((farmer) => {
          const profile = profileMap[farmer.id];
          const status = statusLabel(profile?.verificationStatus);
          const name = farmer.fullName || "Unnamed farmer";
          return <AdminAccountCard key={farmer.id} name={name} email={farmer.email} subtitle={profile?.farmName || "Farm name unavailable"} badge={<StatusBadge tone={TONE[status] || "muted"} dot>{status}</StatusBadge>} onClick={() => navigate(`/admin/farmers/${farmer.id}`)} meta={[{ icon: Building2, label: "Farm", value: profile?.farmName || "Not provided" }, { icon: MapPin, label: "State", value: profile?.farmState || "Not provided" }]} />;
        }) : <div className="col-span-full"><EmptyState icon={UserCheck} title={search ? "No matching farmers" : filter === "All" ? "No farmers" : `No ${filter.toLowerCase()} farmers`} description={search ? "Try another name, email or farm." : "Nothing to review here right now."} /></div>}
      </div>
    </div>
  );
}

function statusLabel(status) {
  return { pending: "Pending", verified: "Approved", rejected: "Rejected", unverified: "Not Submitted" }[status] || "Not Submitted";
}
