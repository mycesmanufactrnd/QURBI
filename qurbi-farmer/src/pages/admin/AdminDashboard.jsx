import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, ChevronRight, Clock, Loader2, ShoppingBag, Tags, UserCheck, Users } from "lucide-react";
import { farmVerificationApi, farmerProfileApi, livestockApi, orderApi, userApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import EmptyState from "@/components/agri/EmptyState";
import SectionHeader from "@/components/agri/SectionHeader";
import StatusBadge from "@/components/agri/StatusBadge";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [farmers, setFarmers] = useState([]);
  const [livestockCount, setLivestockCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      userApi.list({ role: "farmer", page: 1, limit: 100 }),
      farmerProfileApi.list(),
      farmVerificationApi.list({ status: "pending", page: 1, limit: 100 }),
      livestockApi.list({ page: 1, limit: 1 }),
      orderApi.adminList({ page: 1, limit: 1 }),
    ])
      .then(([userPage, profileRows, verificationPage, livestockPage, orderPage]) => {
        const usersById = new Map((userPage.data || []).map((item) => [item.id, item]));
        const profilesById = new Map((profileRows || []).map((item) => [item.id, item]));
        const pending = (verificationPage.data || []).map((verification) => {
          const profile = profilesById.get(verification.farmerProfileId);
          const farmer = profile ? usersById.get(profile.userId) : null;
          return farmer ? { ...farmer, _profile: profile, _verification: verification } : null;
        }).filter(Boolean);
        setFarmers(pending);
        setLivestockCount(livestockPage.total || 0);
        setOrderCount(orderPage.total || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const adminName = user?.data?.name || user?.full_name || user?.email?.split("@")[0] || "Admin";

  return (
    <div className="animate-fade-in">
      <section className="home-brand-hero -mx-4 -mt-3 px-5 pb-14 pt-6 text-white lg:mx-0 lg:mt-0 lg:px-8 lg:pb-16">
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">QURBI administration</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight lg:text-3xl">Welcome back, {adminName.split(" ")[0]}</h1>
          <p className="mt-1 max-w-lg text-sm text-white/70">Review farmer activity and manage the marketplace from one place.</p>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-secondary ring-1 ring-white/15 backdrop-blur"><BadgeCheck className="h-4 w-4" /> Super Admin</span>
            <span className="min-w-0 truncate rounded-full bg-black/10 px-3 py-1.5 text-[11px] font-medium text-white/80 ring-1 ring-white/10">{user?.email}</span>
          </div>
        </div>
      </section>

      <div className="relative z-20 -mx-4 -mt-7 lg:mx-0">
        <div className="rounded-t-[2rem] border-b border-border/60 bg-card px-5 pb-5 pt-6 shadow-[0_-8px_24px_rgba(65,54,45,0.08)] sm:px-6">
          <div className="grid grid-cols-4 gap-2">
            <QuickAction icon={Tags} label="Add Breed" onClick={() => navigate("/admin/breeds?action=add")} primary />
            <QuickAction icon={CowSilhouetteIcon} iconClassName="h-7 w-7" label="Livestock" onClick={() => navigate("/admin/livestock")} />
            <QuickAction icon={Users} label="Buyers" onClick={() => navigate("/admin/users")} />
            <QuickAction icon={ShoppingBag} label="Orders" onClick={() => navigate("/admin/orders")} />
          </div>
        </div>
      </div>

      <SectionHeader title="System Overview" className="mt-6" />
      <div className="soft-card mt-3 grid grid-cols-3 divide-x divide-border/70 overflow-hidden p-1">
        <OverviewMetric icon={Clock} label="Pending Farmers" value={loading ? "—" : farmers.length} tone="warning" onClick={() => navigate("/admin/farmers")} />
        <OverviewMetric icon={CowSilhouetteIcon} label="Livestock" value={loading ? "—" : livestockCount} tone="primary" onClick={() => navigate("/admin/livestock")} />
        <OverviewMetric icon={ShoppingBag} label="Orders" value={loading ? "—" : orderCount} tone="success" onClick={() => navigate("/admin/orders")} />
      </div>

      <div className="mt-7">
        <SectionHeader
          title="Pending Farmer Verifications"
          action={farmers.length > 0 ? <button type="button" onClick={() => navigate("/admin/farmers")} className="min-h-10 rounded-full px-3 text-xs font-bold text-primary hover:bg-secondary/60">See all</button> : null}
        />

        {loading ? (
          <div className="mt-3 flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : farmers.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {farmers.slice(0, 6).map((farmer) => {
              const profile = farmer._profile;
              const name = farmer.fullName || farmer.email?.split("@")[0] || "Unnamed farmer";
              return (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => navigate(`/admin/farmers/${farmer.id}`)}
                  className="soft-card flex min-h-[82px] items-center gap-3 p-3.5 text-left transition-all hover:border-primary/20 hover:shadow-sm"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-sm font-extrabold text-amber-700">{initials(name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{profile?.farmName || "Farm profile"}{profile?.farmState ? ` · ${profile.farmState}` : ""}</span>
                  </span>
                  <StatusBadge tone="warning" dot className="hidden shrink-0 sm:inline-flex">Pending</StatusBadge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState className="mt-3" icon={UserCheck} title="No pending farmers" description="All caught up. New verification requests will appear here." />
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, iconClassName = "h-5 w-5", label, onClick, primary }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:-translate-y-0.5 ${primary ? "brand-gradient text-primary-foreground shadow-[0_5px_14px_rgba(65,54,45,0.2)]" : "bg-secondary/65 text-primary"}`}><Icon className={iconClassName} /></span>
      <span className="text-center text-[10px] font-bold leading-tight text-foreground sm:text-xs">{label}</span>
    </button>
  );
}

function OverviewMetric({ icon: Icon, label, value, tone, onClick }) {
  const tones = {
    primary: "bg-secondary text-primary",
    warning: "bg-amber-100 text-amber-800",
    success: "bg-emerald-100 text-emerald-800",
  };

  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-center px-2 py-3 text-center transition-colors hover:bg-muted/35 sm:px-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <span className="mt-2 text-xl font-extrabold tracking-tight text-foreground">{value}</span>
      <span className="mt-0.5 text-[10px] font-semibold leading-tight text-muted-foreground sm:text-xs">{label}</span>
    </button>
  );
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
