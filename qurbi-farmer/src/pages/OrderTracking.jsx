import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { resolveApiAssetUrl, uploadApi } from "@/api/apiClient";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CircleDollarSign,
  CircleX,
  Clock3,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  MapPinned,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldAlert,
  Tag,
  Truck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/agri/StatusBadge";
import StickyActionBar from "@/components/agri/StickyActionBar";
import { formatMYR, humanize, orderItemTitle, orderPhotoStage, orderStatusMeta, paymentStatusLabel } from "@/lib/agri";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "before", owner: "You" },
  { key: "during", owner: "You" },
  { key: "after", owner: "You" },
  { key: "received", owner: "Buyer" },
];

const ISSUE_STATUSES = ["return_requested", "refund_requested", "return_refund", "refunded"];

function errorMessage(error, fallback) {
  return error?.response?.data?.error || error?.data?.error || error?.message || fallback;
}

function DetailSkeleton() {
  return <div className="space-y-4"><div className="flex gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-24" /></div></div>{[0, 1, 2].map((item) => <Skeleton key={item} className="h-40 w-full rounded-2xl" />)}</div>;
}

function InfoRow({ icon: Icon, label, value, fallback }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="break-words text-base font-bold">{value || fallback}</p></div></div>;
}

function AuthenticatedProofImage({ url, alt }) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    const source = String(url || "");

    setImageUrl("");
    setFailed(false);

    if (!source) {
      setLoading(false);
      setFailed(true);
      return undefined;
    }

    if (!source.includes("/uploads/private/")) {
      setImageUrl(resolveApiAssetUrl(source));
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    uploadApi.getPrivateFile(source)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></span>;
  }

  if (failed || !imageUrl) {
    return <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted"><ImageOff className="h-6 w-6 text-muted-foreground" /></span>;
  }

  return <a href={imageUrl} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-xl bg-muted"><img src={imageUrl} alt={alt} className="h-full w-full object-cover" /></a>;
}

function deliveryAddressDetails(address = {}) {
  const recipientName = address.recipientName || address.recipient_name || address.name || "";
  const recipientPhone = address.recipientPhone || address.recipient_phone || address.phone || "";
  const street = address.addressLine1 || address.address_line1 || address.street || "";
  const secondLine = address.addressLine2 || address.address_line2 || "";
  const locality = [address.postcode, address.city].filter(Boolean).join(" ");
  const region = [address.state, address.country].filter(Boolean).join(", ");
  const lines = [street, secondLine, locality, region].filter(Boolean);
  return {
    recipientName,
    recipientPhone,
    lines,
    text: lines.join(", "),
    note: address.deliveryNote || address.delivery_note || "",
  };
}

export default function OrderTracking() {
  const { t, i18n } = useTranslation("orders");
  const dateTimeFormat = new Intl.DateTimeFormat(i18n.language === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const formatDateTime = (value, fallback = "—") => {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? dateTimeFormat.format(new Date(time)) : fallback;
  };
  const stageLabel = (key) => t(`tracking.stages.${key}.label`);
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState("");
  const [pendingUpload, setPendingUpload] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await qurbi.functions.invoke("fetchFarmerOrders", { orderId });
      const packageOrder = response.data?.order;
      if (!packageOrder) throw new Error(t("tracking.packageNotFound"));
      setOrder(packageOrder);
    } catch (loadError) {
      setOrder(null);
      setError(errorMessage(loadError, t("tracking.packageLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const chooseFile = (stage, file) => {
    if (!file) return;
    setError("");
    setMessage("");
    if (!file.type.startsWith("image/")) { setError(t("tracking.chooseImage")); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t("tracking.tooLarge")); return; }
    setPendingUpload({ stage, file });
  };

  const confirmUpload = async () => {
    if (!pendingUpload || uploading || !order) return;
    const { stage, file } = pendingUpload;
    setPendingUpload(null);
    setUploading(stage);
    setError("");
    setMessage("");
    try {
      const uploaded = await qurbi.integrations.Core.UploadFile({ file });
      if (!uploaded.file_url) throw new Error(t("tracking.uploadFailed"));
      const response = await qurbi.functions.invoke("uploadFarmerTrackingPhoto", {
        orderId: order.id,
        stage,
        imageUrl: uploaded.file_url,
      });
      setOrder(response.data?.order || order);
      setMessage(t("tracking.photoSaved", { stage: stageLabel(stage) }));
      setActiveTab("evidence");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (uploadError) {
      setError(errorMessage(uploadError, t("tracking.saveFailed")));
      await load();
    } finally {
      setUploading("");
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!order) return (
    <div className="py-16 text-center">
      <PackageCheck className="mx-auto h-11 w-11 text-muted-foreground" />
      <p className="mt-3 text-lg font-extrabold">{t("tracking.unavailableTitle")}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{error || t("tracking.unavailableText")}</p>
      <div className="mt-5 flex justify-center gap-2"><Button variant="outline" onClick={() => navigate("/orders")} className="h-11">{t("tracking.backToOrders")}</Button><Button onClick={load} className="h-11"><RefreshCw className="mr-1.5 h-4 w-4" />{t("tracking.tryAgain")}</Button></div>
    </div>
  );

  const tracking = order.tracking_photos || {};
  const meta = orderStatusMeta(order.status);
  const hasIssue = ISSUE_STATUSES.includes(order.status);
  // The backend moves an order one step per photo (paid -> preparing -> in transit -> delivered),
  // so the stage the farmer can upload is decided by the order status.
  const nextStage = order.tracking_enabled !== false && !hasIssue ? orderPhotoStage(order.status) : "";
  const nextStageInfo = STAGES.find((stage) => stage.key === nextStage);
  const nextIndex = STAGES.findIndex((stage) => stage.key === nextStage);
  const statusIndex = meta.group === "buyer" ? 3 : meta.group === "done" ? 4 : nextIndex;
  const shippedAt = tracking.during?.uploaded_at || tracking.after?.uploaded_at || order.deliveredAt || "";
  const receivedProof = (order.receivedProofImages || []).map((url) => resolveApiAssetUrl(url));
  const orderNo = order.order_number || order.id;
  const isCancelled = order.status === "cancelled";
  const isDelivery = order.fulfillment_method !== "pickup";
  const paymentStatus = String(order.payment_status || "").toLowerCase();
  const refundStatus = String(order.refund_status || "").toLowerCase();
  const canRevealDelivery = isDelivery && paymentStatus === "paid" && !isCancelled && refundStatus !== "refunded";
  const deliveryAddress = deliveryAddressDetails(order.delivery_address);
  const recipientNameIsDifferent = deliveryAddress.recipientName
    && deliveryAddress.recipientName.trim().toLowerCase() !== String(order.buyer_name || "").trim().toLowerCase();
  const recipientPhoneIsDifferent = deliveryAddress.recipientPhone
    && deliveryAddress.recipientPhone.replace(/\D/g, "") !== String(order.buyer_phone || "").replace(/\D/g, "");

  const copyDeliveryAddress = async () => {
    if (!deliveryAddress.text) return;
    try {
      await navigator.clipboard.writeText(deliveryAddress.text);
      setMessage(t("tracking.addressCopied"));
    } catch {
      setError(t("tracking.addressCopyFailed"));
    }
  };

  return <div className="animate-fade-in">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => navigate("/orders")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-label={t("tracking.backToOrders")}><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><h1 className="truncate text-xl font-extrabold">{t("tracking.title")}</h1><p className="truncate whitespace-nowrap text-sm text-muted-foreground">#{orderNo}</p></div>
      </div>
      <Button variant="outline" size="icon" onClick={load} disabled={Boolean(uploading)} aria-label={t("tracking.refreshAria")} className="h-11 w-11 rounded-2xl"><RefreshCw className="h-4 w-4" /></Button>
    </div>

    {message && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><Check className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
    {order.multi_farmer_order && <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("tracking.multiNotice")}</span></div>}
    {hasIssue && <div className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("tracking.issueNotice")}</span></div>}
    {isCancelled && <div className="mt-4 flex gap-2 rounded-xl border border-border bg-muted/55 p-3 text-sm text-foreground"><CircleX className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("tracking.closedNotice")}</span></div>}

    <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-muted/70 p-1" role="tablist" aria-label={t("tracking.sectionTabsAria")}>
      {["overview", "delivery", ...(!isCancelled ? ["evidence"] : [])].map((tab) => (
        <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={cn("min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors", activeTab === tab ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t(`tracking.tabs.${tab}`)}</button>
      ))}
    </div>

    <div className="mx-auto mt-4 max-w-3xl">
      {activeTab === "overview" && (
      <div className="min-w-0 space-y-4">
        <section className={cn("rounded-2xl border p-4", nextStage ? "border-amber-300 bg-amber-50/70" : "border-border bg-card")}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-foreground">{t("tracking.orderStatus")}</p>
            <StatusBadge kind="order" status={order.status} dot />
          </div>
          {meta.next && <p className={cn("mt-3 text-base font-bold leading-snug", nextStage ? "text-amber-950" : "text-foreground")}>{t(`next.${order.status}`, { defaultValue: meta.next })}</p>}
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label={t("tracking.progressAria")}>
            {STAGES.map((stage, index) => {
              const done = stage.key === "received" ? meta.group === "done" : Boolean(tracking[stage.key]?.image_url) || index < statusIndex;
              const current = index === statusIndex;
              return (
                <li key={stage.key} className="min-w-0">
                  <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : current ? "bg-amber-400" : "bg-muted")} />
                  <p className={cn("mt-1.5 text-xs font-semibold leading-tight", done ? "text-primary" : current ? "text-amber-900" : "text-muted-foreground")}>{t(`tracking.stages.${stage.key}.progress`)}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-extrabold">{t("tracking.animal")}</h2>
          <div className="mt-3 space-y-3">{order.items?.map((item, index) => {
            const { title, breed } = orderItemTitle(item);
            return (
              <article key={`${item.livestock_id}-${index}`} className="flex gap-3 rounded-xl bg-muted/60 p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">{item.image_url ? <img src={item.image_url} alt={title} className="h-full w-full object-cover" /> : <ImageOff className="h-6 w-6 text-muted-foreground" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold leading-snug">{title}</p>
                  {breed && <p className="truncate text-sm font-semibold text-muted-foreground">{breed}</p>}
                  {item.tag_number && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Tag className="h-3.5 w-3.5" />{item.tag_number}</p>}
                  <p className="mt-1.5 text-base font-extrabold text-primary">{formatMYR(item.total)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{t("tracking.livestockId", { id: item.livestock_id || t("tracking.unavailable") })}</p>
                </div>
              </article>
            );
          })}</div>
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{t("tracking.farmerSubtotal")}</span><span>{formatMYR(order.farmer_subtotal ?? order.farmer_total)}</span></div>
            {Number(order.farmer_delivery_fee) > 0 && <div className="flex justify-between text-muted-foreground"><span>{t("tracking.deliveryFee")}</span><span>{formatMYR(order.farmer_delivery_fee)}</span></div>}
            <div className="flex justify-between text-base font-extrabold"><span>{t("tracking.youReceive")}</span><span className="text-primary">{formatMYR(order.farmer_total)}</span></div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-extrabold">{t("tracking.orderBuyer")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoRow icon={CalendarDays} fallback={t("tracking.notProvided")} label={t("tracking.orderDate")} value={formatDateTime(order.created_date, t("common.notAvailable"))} />
            <InfoRow icon={CircleDollarSign} fallback={t("common.notAvailable")} label={t("tracking.payment")} value={t(`payment.${String(order.payment_status || "").toLowerCase()}`, { defaultValue: paymentStatusLabel(order.payment_status) })} />
            <InfoRow icon={Truck} fallback={t("common.notAvailable")} label={t("tracking.fulfilment")} value={order.fulfillment_method === "pickup" ? t("tracking.buyerPickup") : t("tracking.delivery")} />
            <InfoRow icon={Clock3} fallback={t("common.notAvailable")} label={t("tracking.shipmentDate")} value={shippedAt ? formatDateTime(shippedAt) : t("tracking.notShipped")} />
            <InfoRow icon={UserRound} fallback={t("common.notAvailable")} label={t("tracking.buyerName")} value={order.buyer_name} />
            <InfoRow icon={Phone} fallback={t("common.notAvailable")} label={t("tracking.contact")} value={order.buyer_phone || t("tracking.notProvided")} />
          </div>

        </section>

        {(order.refund_reason || order.refund_status) && <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"><h2 className="text-lg font-extrabold text-destructive">{t("tracking.refundTitle")}</h2>{order.refund_status && <p className="mt-2 text-sm"><span className="font-semibold">{t("tracking.refundStatusLabel")} </span>{t(`refundStatus.${String(order.refund_status).toLowerCase()}`, { defaultValue: humanize(order.refund_status) })}</p>}{order.refund_reason && <p className="mt-1 text-sm"><span className="font-semibold">{t("tracking.refundReason")} </span>{order.refund_reason}</p>}{order.refund_admin_note && <p className="mt-1 text-sm"><span className="font-semibold">{t("tracking.refundAdminNote")} </span>{order.refund_admin_note}</p>}</section>}
      </div>
      )}

      {activeTab === "delivery" && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPinned className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">{t("tracking.deliveryInfo")}</p><p className="mt-0.5 font-extrabold">{isDelivery ? t("tracking.delivery") : t("tracking.buyerPickup")}</p></div>
          </div>
          {!isDelivery && <p className="mt-4 rounded-xl bg-muted/45 p-3 text-sm leading-relaxed text-muted-foreground">{t("tracking.pickupArrangement")}</p>}
          {isDelivery && !canRevealDelivery && <div className="mt-4 rounded-xl bg-muted/45 p-3 text-sm text-muted-foreground"><p className="font-semibold text-foreground">{t("tracking.deliverySelected")}</p><p className="mt-1">{isCancelled || paymentStatus === "refunded" || refundStatus === "refunded" ? t("tracking.addressHiddenClosed") : t("tracking.addressPrivateUntilPaid")}</p></div>}
          {canRevealDelivery && <div className="mt-4 space-y-3">
            {(recipientNameIsDifferent || recipientPhoneIsDifferent) && <div className="rounded-xl bg-muted/45 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tracking.recipient")}</p>{recipientNameIsDifferent && <p className="mt-1 font-bold">{deliveryAddress.recipientName}</p>}{recipientPhoneIsDifferent && <p className="mt-0.5 text-sm text-muted-foreground">{deliveryAddress.recipientPhone}</p>}</div>}
            <div className="rounded-xl bg-muted/45 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tracking.deliveryAddress")}</p>{deliveryAddress.lines.length ? <address className="mt-1 not-italic leading-relaxed">{deliveryAddress.lines.map((line, index) => <span key={`${index}-${line}`} className="block break-words">{line}</span>)}</address> : <p className="mt-1 text-sm text-muted-foreground">{t("tracking.notProvided")}</p>}</div>
            {deliveryAddress.note && <div className="rounded-xl bg-muted/45 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tracking.deliveryNote")}</p><p className="mt-1 whitespace-pre-wrap text-sm">{deliveryAddress.note}</p></div>}
            {deliveryAddress.text && <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="h-11 rounded-xl" onClick={copyDeliveryAddress}><Copy className="mr-2 h-4 w-4" />{t("tracking.copyAddress")}</Button><Button asChild variant="outline" className="h-11 rounded-xl"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress.text)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("tracking.openMaps")}</a></Button></div>}
          </div>}
          {order.buyer_phone && <a href={`tel:${order.buyer_phone}`} className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/5 text-sm font-bold text-primary"><Phone className="mr-2 h-4 w-4" />{t("tracking.callBuyer")}</a>}
        </section>
      )}

    {activeTab === "overview" && isCancelled && (
      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><CircleX className="h-5 w-5" /></span><div className="min-w-0"><h2 className="font-extrabold">{t("tracking.cancellationSummary")}</h2><p className="mt-0.5 text-sm text-muted-foreground">{t("tracking.cancellationReleased")}</p></div></div>
        <div className="mt-4 grid gap-3 rounded-xl bg-muted/45 p-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">{t("tracking.cancelledBy")}</p><p className="mt-0.5 font-bold">{t(`role.${order.cancelled_by || "Buyer"}`, { defaultValue: order.cancelled_by || "Buyer" })}</p></div><div><p className="text-xs text-muted-foreground">{t("tracking.cancelledAt")}</p><p className="mt-0.5 font-bold">{formatDateTime(order.cancelled_at, t("common.notAvailable"))}</p></div><div className="sm:col-span-2"><p className="text-xs text-muted-foreground">{t("tracking.reason")}</p><p className="mt-0.5 whitespace-pre-wrap font-semibold">{order.cancellation_reason || t("tracking.noReason")}</p></div></div>
      </section>
    )}

      {activeTab === "evidence" && !isCancelled && (
      <section className="mt-4 min-w-0 rounded-2xl border border-border bg-card p-4 lg:mt-0">
        <h2 className="text-lg font-extrabold">{t("tracking.deliveryPhotos")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("tracking.deliveryPhotosHelp")}</p>
        <ol className="mt-5 space-y-4">{STAGES.map((stage, index) => {
          const proof = tracking[stage.key];
          const complete = stage.key === "received" ? meta.group === "done" : Boolean(proof?.image_url);
          const current = stage.key === nextStage;
          const passed = !complete && index < statusIndex;
          return (
            <li key={stage.key} className="flex gap-3">
              <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold", complete ? "bg-primary text-primary-foreground" : current ? "bg-amber-100 text-amber-900 ring-2 ring-amber-300" : "bg-muted text-muted-foreground")}>{complete ? <Check className="h-4 w-4" /> : index + 1}</div>
              <div className="min-w-0 flex-1 border-b border-border pb-4 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-base font-extrabold">{stageLabel(stage.key)}</p><p className="mt-0.5 text-sm text-muted-foreground">{t(`tracking.stages.${stage.key}.description`)}</p></div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{t(`tracking.owner.${stage.owner}`)}</span>
                </div>
                {proof?.image_url ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3"><AuthenticatedProofImage url={proof.image_url} alt={t("tracking.proofAlt", { stage: stageLabel(stage.key) })} /><p className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(proof.uploaded_at)}</p></div>
                ) : stage.key === "received" && receivedProof.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">{receivedProof.map((url) => <AuthenticatedProofImage key={url} url={url} alt={t("tracking.buyerProofAlt")} />)}</div>
                ) : current ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{uploading === stage.key ? t("tracking.uploading") : t("tracking.waitingPhoto")}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {stage.key === "received" ? (meta.group === "done" ? t("tracking.receivedDone") : t("tracking.receivedWaiting"))
                      : order.tracking_enabled === false ? t("tracking.locked")
                        : hasIssue ? t("tracking.paused")
                          : passed ? t("tracking.noPhotoRecorded")
                            : meta.group === "payment" ? t("tracking.afterPayment")
                              : t("tracking.afterPrevious")}
                  </p>
                )}
              </div>
            </li>
          );
        })}</ol>
      </section>
      )}
    </div>

    {nextStageInfo && (
      <StickyActionBar hint={<>{t("tracking.stepHint", { step: nextIndex + 1 })} <strong className="text-foreground">{stageLabel(nextStageInfo.key)}</strong></>}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          disabled={Boolean(uploading)}
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; chooseFile(nextStageInfo.key, file); }}
        />
        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(uploading)} className="h-12 flex-1 rounded-2xl text-base font-bold">
          {uploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
          {uploading ? t("tracking.uploadingPhoto") : t(`tracking.stages.${nextStageInfo.key}.button`)}
        </Button>
      </StickyActionBar>
    )}

    <AlertDialog open={Boolean(pendingUpload)} onOpenChange={(open) => { if (!open && !uploading) setPendingUpload(null); }}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <AlertDialogHeader><AlertDialogTitle>{t("tracking.dialogTitle")}</AlertDialogTitle><AlertDialogDescription><Trans t={t} i18nKey="tracking.dialogDescription" values={{ file: pendingUpload?.file?.name, stage: pendingUpload ? stageLabel(pendingUpload.stage).toLowerCase() : "" }} components={[<span key="0" />, <strong key="1" className="break-all" />, <span key="2" />, <strong key="3" />]} /></AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={Boolean(uploading)} className="h-11">{t("tracking.cancel")}</AlertDialogCancel><AlertDialogAction onClick={confirmUpload} disabled={Boolean(uploading)} className="h-11">{uploading ? t("tracking.uploading") : t("tracking.savePhoto")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
