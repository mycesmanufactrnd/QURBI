import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { qurbi } from "@/api/qurbiClient";
import { Bell, CheckCheck, CheckCircle2, ChevronRight, Loader2, PackageCheck, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/agri/EmptyState";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = () => {
    setLoading(true);
    qurbi.entities.FarmerNotification.list("-created_date", 200)
      .then((rows) => setItems(rows || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    qurbi.functions.invoke("syncFarmerNotifications")
      .catch(() => null)
      .finally(() => load());
    const unsubscribe = qurbi.entities.FarmerNotification.subscribe(() => load());
    return unsubscribe;
  }, []);

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      await qurbi.entities.FarmerNotification.update(notification.id, { isRead: true });
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
    }
    if (notification.orderId) navigate(`/orders/${notification.orderId}`);
    else if (notification.livestockId) navigate(`/livestock/${notification.livestockId}`);
  };

  const markAllRead = async () => {
    const unread = items.filter((item) => !item.isRead);
    if (!unread.length) return;
    setMarking(true);
    try {
      await Promise.all(unread.map((item) => qurbi.entities.FarmerNotification.update(item.id, { isRead: true })));
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Notifications</h1>
          <p className="text-xs text-muted-foreground">{unreadCount} unread update{unreadCount === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unreadCount || marking}>
          {marking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />} Mark all read
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : items.length ? items.map((notification) => {
          const approved = notification.type?.includes("Approved");
          const newOrder = notification.type === "New Order";
          const important = notification.priority === "Important" || notification.type === "Refund Requested";
          const Icon = important ? ShieldAlert : newOrder ? PackageCheck : approved ? CheckCircle2 : notification.type?.includes("Rejected") ? XCircle : Bell;
          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                important ? "border-destructive/40 bg-destructive/5" : notification.isRead ? "border-border bg-card" : "border-primary/40 bg-primary/5"
              )}
            >
              <span className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                important ? "bg-destructive/10 text-destructive" : newOrder ? "bg-sky-100 text-sky-700" : approved ? "bg-emerald-100 text-emerald-700" :
                  notification.type?.includes("Rejected") ? "bg-destructive/10 text-destructive" : "bg-muted text-primary"
              )}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{notification.title}</span>
                  {important && <span className="rounded-full bg-destructive px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-destructive-foreground">IMPORTANT</span>}
                  {!notification.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{notification.message}</span>
                <span className="mt-2 block text-[11px] text-muted-foreground">{new Date(notification.created_date).toLocaleString("en-MY")}</span>
              </span>
              {(notification.orderId || notification.livestockId) && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          );
        }) : (
          <EmptyState icon={Bell} title="No notifications" description="Breed review and other farmer updates will appear here." />
        )}
      </div>
    </div>
  );
}
