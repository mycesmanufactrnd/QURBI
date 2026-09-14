import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { BadgeCheck, Boxes, ChevronRight, Clock, PackageCheck, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import EmptyState from "@/components/agri/EmptyState";
import BrandLogo from "@/components/agri/BrandLogo";
import FeaturedListingsCarousel from "@/components/agri/FeaturedListingsCarousel";
import NotificationBell from "@/components/agri/NotificationBell";
import SectionHeader from "@/components/agri/SectionHeader";
import StatusBadge from "@/components/agri/StatusBadge";
import { Image } from "@/components/ui/image";
import { formatMYR, greeting, initials, userVal } from "@/lib/agri";
import { reconcileOrderLivestockStatuses } from "@/lib/orderLivestockStatus";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";

const ORDER_META = {
  paid: ["To Ship", "info"], to_ship: ["To Ship", "info"], processing: ["Shipping", "primary"],
  shipped: ["Awaiting Buyer", "warning"], to_receive: ["Awaiting Buyer", "warning"], delivering: ["Awaiting Buyer", "warning"],
  completed: ["Completed", "success"], delivered: ["Completed", "success"], return_requested: ["Return Requested", "danger"],
  refund_requested: ["Refund Requested", "danger"], return_refund: ["Return / Refund", "danger"], refunded: ["Refunded", "muted"],
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [livestock, setLivestock] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        // Keep order reconciliation before livestock statistics so Sold/Available remains current.
        const orderResponse = await base44.functions.invoke("fetchFarmerOrders", {});
        const nextOrders = orderResponse.data?.orders;
        if (!Array.isArray(nextOrders)) throw new Error("The order service returned an invalid response.");
        const storedLivestock = await base44.entities.Livestock.list("-created_date", 500);
        const nextLivestock = await reconcileOrderLivestockStatuses(nextOrders, storedLivestock);
        if (!mounted) return;
        setLivestock(nextLivestock || []);
        setOrders(nextOrders);
        setLoadError("");
      } catch (error) {
        console.error("Failed to refresh home data:", error);
        if (mounted) setLoadError("Dashboard data could not be refreshed. Showing the latest available information.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    window.addEventListener("focus", fetchData);
    return () => { mounted = false; window.removeEventListener("focus", fetchData); };
  }, []);

  const name = userVal(user, "name") || user?.full_name || "Farmer";
  const active = livestock.filter((item) => item.status === "Available" && !item.disabled).length;
  const pendingOrders = orders.filter((order) => ["paid", "to_ship"].includes(order.status)).length;
  const sold = livestock.filter((item) => item.status === "Sold").length;
  const recentLivestock = livestock.slice(0, 5);
  const recentOrders = orders.slice(0, 4);

  return (
    <div className="animate-fade-in">
      <section className="home-brand-hero -mx-5 -mt-5 px-5 pb-10 pt-4 text-white lg:mx-0 lg:mt-0 lg:px-8 lg:pb-12 lg:pt-5">
        <header
          className="relative z-10 flex min-h-12 items-center justify-between"
          aria-label="QURBI Farmer header"
        >
          <BrandLogo
            light
            className="[&>div:first-child]:bg-secondary [&>div:first-child]:text-secondary-foreground"
          />
          <div className="flex gap-2 [&_button]:border-white/15 [&_button]:bg-white/10 [&_button]:text-white [&_button]:shadow-none [&_button:hover]:bg-white/20">
            <NotificationBell />
            <button
              type="button"
              onClick={() => navigate("/profile")}
              aria-label="Open farmer profile"
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-secondary/70 bg-secondary font-extrabold text-secondary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {userVal(user, "profilePhoto") ? (
                <Image
                  src={userVal(user, "profilePhoto")}
                  fittingType="fill"
                  alt="Farmer profile"
                  className="h-full w-full"
                />
              ) : (
                initials(name)
              )}
            </button>
          </div>
        </header>
        <div className="relative z-10 mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/70">{greeting()},</p>
            <h1 className="truncate text-2xl font-extrabold tracking-tight lg:text-3xl">{name.split(" ")[0]}</h1>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-secondary ring-1 ring-white/15 backdrop-blur"><BadgeCheck className="h-4 w-4" /> Verified Farmer</span>
          </div>
        </div>
      </section>

      <div className="relative z-20 -mx-5 -mt-6 lg:mx-0">
        <div className="rounded-t-[2rem] border-b border-border/60 bg-card px-5 pb-5 pt-5 shadow-[0_-8px_24px_rgba(65,54,45,0.08)] sm:px-6">
          <div className="grid grid-cols-4 gap-2">
            <QuickAction icon={Plus} label="Add Livestock" onClick={() => navigate("/livestock/add")} primary />
            <QuickAction icon={ShoppingBag} label="Orders" onClick={() => navigate("/orders")} />
            <QuickAction icon={CowSilhouetteIcon} iconClassName="h-8 w-8" label="My Livestock" onClick={() => navigate("/livestock")} />
            <QuickAction icon={Boxes} label="Bulk Sell" onClick={() => navigate("/bulk")} />
          </div>
        </div>
      </div>

      <SectionHeader title="Farm Overview" className="mt-6" />
      <div className="soft-card mt-3 grid grid-cols-3 divide-x divide-border/70 overflow-hidden p-1">
        <OverviewMetric icon={PackageCheck} label="Active Listings" value={loading ? "—" : active} tone="primary" onClick={() => navigate("/livestock")} />
        <OverviewMetric icon={Clock} label="Pending Orders" value={loading ? "—" : pendingOrders} tone="warning" onClick={() => navigate("/orders")} />
        <OverviewMetric icon={TrendingUp} label="Sold Animals" value={loading ? "—" : sold} tone="success" onClick={() => navigate("/livestock")} />
      </div>

      {loadError && <p role="status" className="mt-3 rounded-2xl bg-amber-100/70 px-4 py-3 text-xs font-medium text-amber-900">{loadError}</p>}

      <div className="mt-7">
        <SectionHeader title="Available Livestock" action={<button onClick={() => navigate("/livestock")} className="min-h-10 rounded-full px-3 text-xs font-bold text-primary hover:bg-secondary/60">See all</button>} />
        {loading ? (
          <div className="mt-3 aspect-[4/3] animate-pulse rounded-[1.25rem] bg-muted sm:aspect-[16/7]" />
        ) : recentLivestock.length ? (
          <div className="mt-3"><FeaturedListingsCarousel items={recentLivestock} onView={(item) => navigate(`/livestock/${item.id}`)} /></div>
        ) : (
          <EmptyState className="mt-3" icon={CowSilhouetteIcon} title="No listings yet" description="Add your first animal to start selling on QURBI." action={<button onClick={() => navigate("/livestock/add")} className="brand-gradient min-h-11 rounded-2xl px-5 text-sm font-bold text-white">Add Livestock</button>} />
        )}
      </div>

      {recentOrders.length > 0 && (
        <div className="mt-7">
          <SectionHeader title="Recent Orders" action={<button onClick={() => navigate("/orders")} className="min-h-10 rounded-full px-3 text-xs font-bold text-primary hover:bg-secondary/60">See all</button>} />
          <div className="mt-3 space-y-2.5">
            {recentOrders.map((order) => (
              <button key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="soft-card flex min-h-[78px] w-full items-center gap-3 p-3.5 text-left transition-all hover:border-primary/20 hover:bg-card/80">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-xs font-bold text-primary">#{order.order_number || order.id.slice(-6).toUpperCase()}</span><StatusBadge tone={ORDER_META[order.status]?.[1] || "muted"} dot>{ORDER_META[order.status]?.[0] || order.status}</StatusBadge></div>
                  <p className="mt-0.5 truncate text-sm font-bold">{order.items?.[0]?.species || "Livestock"}</p>
                  <p className="text-xs text-muted-foreground">{order.buyer_name || "—"}</p>
                </div>
                <div className="shrink-0 text-right"><p className="text-sm font-extrabold text-primary">{formatMYR(order.farmer_total)}</p><ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" /></div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, iconClassName = "h-5 w-5", label, onClick, primary }) {
  return (
    <button onClick={onClick} className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
