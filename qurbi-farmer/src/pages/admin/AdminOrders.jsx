import React, { useEffect, useMemo, useState } from "react";
import { qurbi } from "@/api/qurbiClient";
import StatusBadge from "@/components/agri/StatusBadge";
import EmptyState from "@/components/agri/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, Loader2, RefreshCw, RotateCcw, ShieldAlert, ShoppingBag, X } from "lucide-react";
import { formatMYR } from "@/lib/agri";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "refunds", label: "Pending Refunds" },
  { key: "all", label: "All Orders" },
  { key: "reviewed", label: "Reviewed Refunds" },
];

const TONES = {
  pending: "warning", paid: "info", to_ship: "info", processing: "primary",
  shipped: "primary", to_receive: "warning", delivering: "primary",
  completed: "success", delivered: "success", refund_requested: "warning",
  refunded: "success", cancelled: "danger", out_of_stock: "danger",
};

function statusLabel(order) {
  if (order.status === "refund_requested" && order.refund_status === "pending_admin_approval") return "Refund Pending";
  if (order.refund_status === "rejected") return "Refund Rejected";
  if (order.status === "refunded") return "Refunded";
  return String(order.status || "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function orderTotal(order) {
  return Number(order.total ?? (order.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0));
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("refunds");
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    qurbi.functions.invoke("fetchAdminBuyerOrders")
      .then((response) => setOrders(response.data?.orders || []))
      .catch((loadError) => setError(loadError.response?.data?.error || loadError.message || "Orders could not be loaded"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pendingCount = orders.filter((order) => order.status === "refund_requested" && order.refund_status === "pending_admin_approval").length;
  const shownOrders = useMemo(() => {
    if (filter === "refunds") return orders.filter((order) => order.status === "refund_requested" && order.refund_status === "pending_admin_approval");
    if (filter === "reviewed") return orders.filter((order) => order.status === "refunded" || order.refund_status === "rejected");
    return orders;
  }, [filter, orders]);

  const submitReview = async () => {
    if (!review || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      const response = await qurbi.functions.invoke("reviewBuyerRefund", {
        orderId: review.order.id,
        decision: review.decision,
        reason: reason.trim(),
      });
      const updated = response.data?.order;
      if (updated) {
        setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
        window.dispatchEvent(new Event("admin-refunds-changed"));
      }
      setReview(null);
      setReason("");
    } catch (reviewError) {
      setError(reviewError.response?.data?.error || reviewError.message || "Refund review failed");
      setReview(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-extrabold tracking-tight">Orders &amp; Refunds</h1><p className="mt-0.5 text-xs text-muted-foreground">Buyer orders retrieved from the QURBI User app.</p></div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />Refresh</Button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => {
          const count = item.key === "refunds" ? pendingCount : item.key === "reviewed" ? orders.filter((order) => order.status === "refunded" || order.refund_status === "rejected").length : orders.length;
          return <button key={item.key} onClick={() => setFilter(item.key)} className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-semibold", filter === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{item.label} {count}</button>;
        })}
      </div>

      {pendingCount > 0 && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-extrabold">Important: {pendingCount} refund request{pendingCount === 1 ? "" : "s"} awaiting review</p><p className="mt-0.5 text-xs opacity-80">Review the buyer reason and order evidence before approving or rejecting.</p></div></div>}

      {error && <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading ? <div className="col-span-full flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          : shownOrders.length ? shownOrders.map((order) => {
            const pendingRefund = order.status === "refund_requested" && order.refund_status === "pending_admin_approval";
            return <article key={order.id} className={cn("rounded-2xl border bg-card p-4", pendingRefund ? "border-destructive/40 bg-destructive/[0.025]" : "border-border")}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-primary">#{order.order_number || order.id}</p><p className="mt-1 text-xs text-muted-foreground">{order.created_date ? new Date(order.created_date).toLocaleString("en-MY") : "Date unavailable"}</p></div><StatusBadge tone={TONES[order.status] || "muted"} dot>{statusLabel(order)}</StatusBadge></div>
              <div className="mt-3 rounded-xl bg-muted/60 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Buyer</p><p className="mt-0.5 text-sm font-bold">{order.buyer_name || "Buyer"}</p><p className="text-xs text-muted-foreground">{order.buyer_email || "Email unavailable"}</p></div>
              <div className="mt-3 space-y-2">{(order.items || []).map((item, index) => <div key={`${item.livestock_id || "item"}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate"><strong>{item.animal || "Livestock"}</strong> · {item.breed || "Unspecified"}</span><span className="shrink-0 font-bold">{formatMYR(item.total ?? item.price_per_head)}</span></div>)}</div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><span className="text-xs text-muted-foreground">Order total</span><span className="text-lg font-extrabold text-primary">{formatMYR(orderTotal(order))}</span></div>
              {(order.refund_reason || order.refund_admin_note) && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Buyer refund reason</p><p className="mt-1 text-amber-900">{order.refund_reason || "No reason supplied"}</p>{order.refund_admin_note && <><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Admin review reason</p><p className="mt-1">{order.refund_admin_note}</p></>}</div>}
              {pendingRefund && <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="text-destructive" onClick={() => { setReview({ order, decision: "reject" }); setReason(""); }}><X className="mr-1.5 h-4 w-4" />Reject</Button><Button onClick={() => { setReview({ order, decision: "approve" }); setReason(""); }}><Check className="mr-1.5 h-4 w-4" />Approve</Button></div>}
            </article>;
          }) : <div className="col-span-full"><EmptyState icon={filter === "refunds" ? RotateCcw : ShoppingBag} title={filter === "refunds" ? "No pending refunds" : "No orders found"} description={filter === "refunds" ? "New buyer refund requests will appear here." : "No buyer orders match this filter."} /></div>}
      </div>

      <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !submitting) { setReview(null); setReason(""); } }}><DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>{review?.decision === "approve" ? "Approve" : "Reject"} refund request</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-xl bg-muted p-3 text-sm"><p className="font-bold">#{review?.order?.order_number || review?.order?.id}</p><p className="mt-1 text-xs text-muted-foreground">{review?.order?.refund_reason}</p></div><div><Label>Reason shown in order record *</Label><Textarea className="mt-1.5" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain this decision..." /></div><Button onClick={submitReview} disabled={!reason.trim() || submitting} variant={review?.decision === "approve" ? "default" : "destructive"} className="w-full">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm {review?.decision === "approve" ? "approval" : "rejection"}</Button></div></DialogContent></Dialog>
    </div>
  );
}
