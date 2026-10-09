import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { Bell, CheckCheck, CheckCircle2, ChevronRight, Loader2, PackageCheck, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/agri/ConfirmDialog";
import EmptyState from "@/components/agri/EmptyState";
import LoadMoreButton from "@/components/agri/LoadMoreButton";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime, formatRelative } from "@/lib/agri";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [marking, setMarking] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [toDelete, setToDelete] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    qurbi.entities.FarmerNotification.list("-created_date", 200)
      .then((rows) => setItems(rows || []))
      .catch((error) => setLoadError(error?.message || t("loadFailed")))
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
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
      await qurbi.entities.FarmerNotification.update(notification.id, { isRead: true }).catch(() => null);
    }
    if (notification.orderId) navigate(`/orders/${notification.orderId}`);
    else if (notification.livestockId) navigate(`/livestock/${notification.livestockId}`);
  };

  const markAllRead = async () => {
    const unread = items.filter((item) => !item.isRead);
    if (!unread.length) return;
    setMarking(true);
    try {
      await qurbi.entities.FarmerNotification.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } finally {
      setMarking(false);
    }
  };

  const clearNotification = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await qurbi.entities.FarmerNotification.delete(toDelete.id);
      setItems((current) => current.filter((item) => item.id !== toDelete.id));
      setToDelete(null);
      toast({ title: t("deleteSuccess") });
    } catch (error) {
      toast({ title: t("deleteFailed"), description: error?.message || t("retry"), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const clearAllNotifications = async () => {
    if (!items.length || deleting) return;
    setDeleting(true);
    try {
      await qurbi.entities.FarmerNotification.clearAll();
      setItems([]);
      setVisibleCount(10);
      setConfirmClearAll(false);
      toast({ title: t("clearAllSuccess") });
    } catch (error) {
      toast({ title: t("clearAllFailed"), description: error?.message || t("retry"), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{unreadCount ? t("newUpdates", { count: unreadCount }) : t("allCaughtUp")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={markAllRead} disabled={!unreadCount || marking} className="h-11 rounded-2xl px-3">
            {marking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />} {t("markAllRead")}
          </Button>
          <Button variant="outline" onClick={() => setConfirmClearAll(true)} disabled={!items.length || deleting} className="h-11 w-11 rounded-2xl p-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={t("clearAll")} title={t("clearAll")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="min-h-11 shrink-0 rounded-xl bg-card px-3 font-bold">{t("retry")}</button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : items.length ? <>{items.slice(0, visibleCount).map((notification) => {
          const approved = notification.type?.includes("Approved");
          const rejected = notification.type?.includes("Rejected");
          const newOrder = notification.type === "New Order";
          const important = notification.priority === "Important" || notification.type === "Refund Requested";
          const Icon = important ? ShieldAlert : newOrder ? PackageCheck : approved ? CheckCircle2 : rejected ? XCircle : Bell;
          const linked = Boolean(notification.orderId || notification.livestockId);
          return (
            <article
              key={notification.id}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                important ? "border-destructive/40 bg-destructive/5" : notification.isRead ? "border-border bg-card" : "border-primary/30 bg-card shadow-[0_4px_14px_rgba(65,54,45,0.08)]"
              )}
            >
              {!notification.isRead && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" aria-hidden="true" />}
              <button type="button" onClick={() => openNotification(notification)} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  important || rejected ? "bg-destructive/10 text-destructive" : newOrder ? "bg-sky-100 text-sky-800" : approved ? "bg-emerald-100 text-emerald-800" : "bg-secondary/70 text-primary"
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-base text-foreground", notification.isRead ? "font-semibold" : "font-extrabold")}>{notification.title}</span>
                    {important && <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-destructive-foreground">{t("important")}</span>}
                    {!notification.isRead && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{t("new")}</span>}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{notification.message}</span>
                  <span className="mt-2 block text-sm text-muted-foreground" title={formatDateTime(notification.created_date)}>{formatRelative(notification.created_date) || formatDateTime(notification.created_date)}{linked ? ` · ${t("tapToOpen")}` : ""}</span>
                </span>
                {linked && <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground" />}
              </button>
              <button type="button" onClick={() => setToDelete(notification)} aria-label={t("deleteAria", { title: notification.title })} title={t("delete")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive">
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </article>
          );
        })}<LoadMoreButton shown={visibleCount} total={items.length} onClick={() => setVisibleCount((count) => count + 10)} /></> : !loadError ? (
          <EmptyState icon={Bell} title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => { if (!open && !deleting) setToDelete(null); }}
        title={t("deleteTitle")}
        description={t("deleteDescription", { title: toDelete?.title || "" })}
        confirmText={t("delete")}
        destructive
        loading={deleting}
        onConfirm={clearNotification}
      />
      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={(open) => { if (!deleting) setConfirmClearAll(open); }}
        title={t("clearAllTitle")}
        description={t("clearAllDescription")}
        confirmText={t("clearAll")}
        destructive
        loading={deleting}
        onConfirm={clearAllNotifications}
      />
    </div>
  );
}
