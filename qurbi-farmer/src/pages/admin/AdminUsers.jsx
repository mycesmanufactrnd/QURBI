import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/agri/EmptyState";
import StatusBadge from "@/components/agri/StatusBadge";
import AdminAccountCard from "@/components/agri/AdminAccountCard";
import { AlertCircle, CalendarDays, Loader2, RefreshCw, Search, ShoppingBag, Users } from "lucide-react";

function buyerName(buyer) {
  return buyer.name || buyer.full_name || buyer.email?.split("@")[0] || "Unnamed buyer";
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-MY") : "Not available";
}

export default function AdminUsers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [response, localAdmins] = await Promise.all([
        base44.functions.invoke("fetchAisyahUsers"),
        base44.entities.User.filter({ role: "admin" }, "-created_date", 500),
      ]);
      const rows = response?.data?.users;
      if (!Array.isArray(rows)) throw new Error("QURBI User returned an invalid buyer list.");
      const adminEmails = new Set(
        (localAdmins || [])
          .map((admin) => admin.email?.trim().toLowerCase())
          .filter(Boolean),
      );
      setBuyers(rows.filter((buyer) => {
        const email = buyer.email?.trim().toLowerCase();
        const role = (buyer.data?.role || buyer.role || "").trim().toLowerCase();
        return Boolean(email) && role !== "admin" && !adminEmails.has(email);
      }));
    } catch (loadError) {
      setBuyers([]);
      setError(loadError?.response?.data?.error || loadError?.message || "Could not retrieve buyers from QURBI User.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return buyers;
    return buyers.filter((buyer) => `${buyerName(buyer)} ${buyer.email || ""}`.toLowerCase().includes(term));
  }, [buyers, search]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Account management</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Buyer Accounts</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">View accounts registered in QURBI User.</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh buyer accounts" className="shrink-0 rounded-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="soft-card mt-5 flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><ShoppingBag className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">QURBI User buyers</p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Synced from the buyer app</p>
        </div>
        {!loading && !error && <StatusBadge tone="info" className="shrink-0">{buyers.length} buyer{buyers.length === 1 ? "" : "s"}</StatusBadge>}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div><p className="text-sm font-bold text-destructive">Buyer data could not be loaded</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><p className="mt-2 text-xs text-muted-foreground">Check that `fetchAisyahUsers` is deployed and its QURBI User app access is still valid.</p></div>
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="buyer-search" className="mb-2 block text-xs font-bold text-foreground">Find a buyer</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="buyer-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="h-12 rounded-2xl bg-card pl-10" disabled={loading || Boolean(error)} />
        </div>
      </div>

      {!loading && !error && <p className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">Showing {filtered.length} of {buyers.length} buyer{buyers.length === 1 ? "" : "s"}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? null : filtered.length ? filtered.map((buyer) => {
          const name = buyerName(buyer);
          return <AdminAccountCard key={buyer.id || buyer.email} name={name} email={buyer.email} badge={<StatusBadge tone="info">Buyer</StatusBadge>} accent="buyer" meta={[{ icon: CalendarDays, label: "Registered", value: dateTime(buyer.created_date || buyer.firstSeenAt) }]} />;
        }) : (
          <div className="col-span-full"><EmptyState icon={Users} title={search ? "No matching buyers" : "No buyer data yet"} description={search ? "Try another buyer name or email." : "QURBI User is connected, but it currently returned zero buyer accounts."} /></div>
        )}
      </div>
    </div>
  );
}
