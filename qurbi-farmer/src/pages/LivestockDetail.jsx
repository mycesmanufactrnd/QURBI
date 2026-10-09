import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle, ArrowLeft, RefreshCw, CalendarDays, Hash, Loader2, MapPin, Palette, Pencil, Ruler, Tag, Trash2, UserRound, Utensils, Weight,
} from "lucide-react";
import { qurbi } from "@/api/qurbiClient";
import { resolveApiAssetUrl } from "@/api/apiClient";
import ConfirmDialog from "@/components/agri/ConfirmDialog";
import SectionHeader from "@/components/agri/SectionHeader";
import StatusBadge from "@/components/agri/StatusBadge";
import StickyActionBar from "@/components/agri/StickyActionBar";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import { formatMYR, listingExpiry, malaysiaState } from "@/lib/agri";
import { useLivestockDisplay } from "@/lib/livestockDisplay";
import { cn } from "@/lib/utils";
import { hasActivePaymentReservation, reservationExpiryLabel } from "@/lib/livestockReservation";


export default function LivestockDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const display = useLivestockDisplay();
  const { t } = display;
  const [item, setItem] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [farmAddress, setFarmAddress] = useState("");
  const [farmState, setFarmState] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    return qurbi.functions.invoke("checkLivestockReservation", { livestockId: id })
      .catch(() => null)
      .then(() => qurbi.entities.Livestock.get(id))
      .then(async (data) => {
        setItem(data);
        setActiveImg(0);

        const profiles = data.ownerId
          ? await qurbi.entities.FarmerProfile.filter({ userId: data.ownerId }).catch(() => [])
          : [];
        const farmerProfile = profiles?.[0];
        const correctState = malaysiaState(data.state, data.farmLocation, farmerProfile?.state);
        setFarmAddress(farmerProfile?.address || "");
        setFarmState(correctState);
        if (correctState && data.state !== correctState) {
          await qurbi.entities.Livestock.update(data.id, { state: correctState }).catch(() => null);
          setItem((current) => ({ ...current, state: correctState }));
        }
      })
      .catch((error) => setLoadError(error?.response?.status === 404 ? t("detail.notFound") : error?.message || t("detail.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await qurbi.entities.Livestock.delete(id);
      navigate("/livestock", { replace: true });
    } catch (error) {
      toast({ title: t("myLivestock.toastDeleteFailedTitle"), description: error.message || t("myLivestock.toastTryAgain"), variant: "destructive" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!item) return (
    <div className="py-16 text-center">
      <AlertCircle className="mx-auto h-11 w-11 text-muted-foreground" />
      <p className="mt-3 text-lg font-extrabold">{t("detail.unavailableTitle")}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError || t("detail.loadFailed")}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={() => navigate("/livestock")} className="min-h-11 rounded-2xl bg-card px-4 text-sm font-bold ring-1 ring-border">{t("detail.backToList")}</button>
        <button type="button" onClick={load} className="brand-gradient flex min-h-11 items-center gap-1.5 rounded-2xl px-4 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" />{t("detail.tryAgain")}</button>
      </div>
    </div>
  );

  const images = item.images?.length ? item.images : (item.coverImage ? [item.coverImage] : []);
  const videos = item.videos?.length ? item.videos : [];
  const location = malaysiaState(item.state, item.farmLocation, farmState);
  const paymentReserved = hasActivePaymentReservation(item);
  const expiry = listingExpiry(item);
  const listingExpired = item.status === "Available" && expiry.expired;
  const eligibleFrom = item.marketplaceEligibleFrom ? new Date(item.marketplaceEligibleFrom) : null;
  const waitingForMinimumAge = Boolean(eligibleFrom && eligibleFrom > new Date());
  const eligibleFromLabel = waitingForMinimumAge
    ? new Intl.DateTimeFormat(display.locale, { day: "numeric", month: "short", year: "numeric" }).format(eligibleFrom)
    : "";
  const status = display.status(item.status, item);
  const title = display.title(item);
  const subtitle = display.subtitle(item);

  return (
    <div className="animate-fade-in">
      <header className="sticky top-0 z-20 -mx-5 flex items-center justify-between border-b border-border/50 bg-background/90 px-5 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label={t("detail.goBack")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-[0_2px_8px_rgba(65,54,45,0.07)] ring-1 ring-border/70"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("detail.headerEyebrow")}</p>
            <h1 className="truncate text-xl font-extrabold tracking-tight">{t("detail.headerTitle")}</h1>
          </div>
        </div>
        {!paymentReserved && <button type="button" onClick={() => navigate(`/livestock/${id}/edit`)} className="flex min-h-11 items-center gap-2 rounded-2xl bg-secondary/70 px-3.5 text-sm font-bold text-primary hover:bg-secondary"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">{t("detail.edit")}</span></button>}
      </header>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,.92fr)] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <section aria-label={t("detail.galleryAria")} className="soft-card overflow-hidden p-2">
            <div className="aspect-[4/3] overflow-hidden rounded-[1rem] bg-muted sm:aspect-[16/11]">
              {images.length ? <Image src={images[activeImg]} fittingType="fill" alt={t("detail.photoAlt", { title, number: activeImg + 1 })} className="h-full w-full" /> : <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">{t("detail.noImage")}</div>}
            </div>
            {images.length > 1 && (
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto p-1">
                {images.map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setActiveImg(index)} aria-label={t("detail.showImage", { number: index + 1 })} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-card transition-all", index === activeImg ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")}>
                    <Image src={url} fittingType="fill" alt="" className="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {videos.length > 0 && (
            <section>
              <SectionHeader title={t("detail.videos")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{videos.map((url, index) => <video key={`${url}-${index}`} src={resolveApiAssetUrl(url)} controls preload="metadata" className="aspect-video w-full rounded-[1.25rem] bg-black shadow-sm" />)}</div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <section className="soft-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <StatusBadge tone={status.tone} dot>{status.label}</StatusBadge>
                <h2 className="mt-3 break-words text-2xl font-extrabold leading-tight tracking-tight text-primary">{title}</h2>
                {subtitle && <p className="mt-1 truncate text-base font-semibold text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("detail.price")}</p>
                <p className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{formatMYR(item.price)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <SummaryItem icon={CalendarDays} label={t("detail.age")} value={display.age(item)} />
              <SummaryItem icon={UserRound} label={t("detail.gender")} value={item.gender ? display.gender(item.gender) : t("detail.notSpecified")} />
              {item.color && <SummaryItem icon={Palette} label={t("detail.color")} value={item.color} />}
              {location && <SummaryItem icon={MapPin} label={t("detail.state")} value={location} />}
            </div>
          </section>

          <ApprovalMessages item={item} />

          {!paymentReserved && listingExpired && <section className="rounded-2xl bg-destructive/10 p-4 text-destructive"><p className="text-sm font-extrabold">{t("detail.expiredTitle")}</p><p className="mt-1 text-sm leading-6">{t("detail.expiredText", { date: display.expiryLabel(item) })}</p></section>}

          {!paymentReserved && item.status === "Draft" && <section className="rounded-2xl bg-sky-50 p-4 text-sky-900"><p className="text-sm font-extrabold">{t("detail.draftTitle")}</p><p className="mt-1 text-sm leading-6">{t("detail.draftText")}</p></section>}
          {!paymentReserved && item.status === "Unavailable" && <section className="rounded-2xl bg-muted p-4"><p className="text-sm font-extrabold">{t("detail.hiddenTitle")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("detail.hiddenText")}</p></section>}
          {!paymentReserved && item.status === "Available" && waitingForMinimumAge && <section className="rounded-2xl bg-amber-100/75 p-4 text-amber-900"><p className="text-sm font-extrabold">{t("detail.minimumAgeTitle")}</p><p className="mt-1 text-sm leading-6">{t("detail.minimumAgeText", { date: eligibleFromLabel })}</p></section>}
          {!paymentReserved && item.status === "Available" && !waitingForMinimumAge && !expiry.expired && expiry.expiresAt && <section className="soft-card p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{t("detail.visibleTitle")}</p><p className="mt-1 text-sm font-semibold">{t("detail.visibleText", { date: display.expiryLabel(item), count: expiry.daysRemaining })}</p></section>}

          {paymentReserved && <section className="rounded-2xl bg-amber-100/75 p-4 text-amber-900"><p className="text-sm font-extrabold">{t("detail.reservedTitle")}</p><p className="mt-1 text-sm leading-6">{t("detail.reservedText", { time: reservationExpiryLabel(item) })}</p></section>}

          {farmAddress && (
            <section className="soft-card flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/70 text-primary"><MapPin className="h-5 w-5" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{t("detail.farmAddress")}</p><p className="mt-1 text-sm font-semibold leading-5 text-foreground">{farmAddress}</p></div>
            </section>
          )}

          {item.description && (
            <section className="soft-card p-5">
              <h2 className="text-lg font-extrabold tracking-tight">{t("detail.about")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>
            </section>
          )}

          <SpecGrid item={item} />

        </div>
      </div>

      {!paymentReserved && (
        <StickyActionBar>
          <button type="button" onClick={() => navigate(`/livestock/${id}/edit`)} className="brand-gradient flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white shadow-[0_4px_12px_rgba(65,54,45,0.15)]"><Pencil className="h-[18px] w-[18px]" />{listingExpired ? t("detail.updateRenew") : t("detail.editListing")}</button>
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label={t("detail.deleteAria")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/10"><Trash2 className="h-5 w-5" /></button>
        </StickyActionBar>
      )}

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={t("myLivestock.deleteTitle")} description={t("myLivestock.deleteDescription", { name: title })} confirmText={t("myLivestock.deleteConfirm")} destructive loading={deleting} onConfirm={doDelete} />
    </div>
  );
}

function ApprovalMessages({ item }) {
  const { t } = useTranslation("livestock");
  const messages = [];
  if (item.speciesApprovalStatus === "Pending") messages.push({ tone: "warning", text: t("detail.approval.speciesPending") });
  if (item.speciesApprovalStatus === "Rejected") messages.push({ tone: "danger", text: t("detail.approval.speciesRejected") });
  if (item.breedApprovalStatus === "Pending") messages.push({ tone: "warning", text: t("detail.approval.breedPending") });
  if (item.breedApprovalStatus === "Rejected") messages.push({ tone: "danger", text: t("detail.approval.breedRejected") });
  if (!messages.length) return null;

  return <div className="space-y-2">{messages.map((message, index) => <div key={`${message.tone}-${index}`} className={cn("flex items-start gap-2.5 rounded-2xl p-3.5 text-xs leading-relaxed", message.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-amber-100/75 text-amber-900")}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{message.text}</span></div>)}</div>;
}

function SummaryItem({ icon: Icon, label, value }) {
  return <div className="rounded-2xl bg-muted/60 p-3"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary/70" />{label}</p><p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p></div>;
}

function SpecGrid({ item }) {
  const { t } = useTranslation("livestock");
  const rows = [
    { icon: Weight, label: t("detail.specs.weight"), value: item.weight, suffix: "kg" },
    { icon: Ruler, label: t("detail.specs.height"), value: item.height, suffix: "cm" },
    { icon: Ruler, label: t("detail.specs.bodyLength"), value: item.bodyLength, suffix: "cm" },
    { icon: Ruler, label: t("detail.specs.chestGirth"), value: item.chestGirth, suffix: "cm" },
    { icon: Hash, label: t("detail.specs.tagNumber"), value: item.tagNumber || item.earTag },
    { icon: Tag, label: t("detail.specs.rfid"), value: item.rfid },
  ].filter((row) => row.value);

  if (!rows.length && !item.feedDetails && !item.specialNotes) return null;

  return (
    <section>
      <SectionHeader title={t("detail.specs.heading")} />
      <div className="mt-3 space-y-3">
        {rows.length > 0 && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{rows.map((row) => <div key={row.label} className="soft-card p-3.5"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-muted-foreground"><row.icon className="h-3.5 w-3.5 text-primary/70" />{row.label}</p><p className="mt-1 text-sm font-extrabold">{row.value}{row.suffix ? ` ${row.suffix}` : ""}</p></div>)}</div>}
        {item.feedDetails && <Note icon={Utensils} title={t("detail.specs.feed")} text={item.feedDetails} />}
        {item.specialNotes && <Note icon={Tag} title={t("detail.specs.notes")} text={item.specialNotes} />}
      </div>
    </section>
  );
}

function Note({ icon: Icon, title, text }) {
  return <div className="soft-card p-4"><p className="flex items-center gap-2 text-sm font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/70 text-primary"><Icon className="h-4 w-4" /></span>{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function DetailSkeleton() {
  const { t } = useTranslation("livestock");
  return <div className="animate-pulse"><div className="h-12 w-52 rounded-2xl bg-muted" /><div className="mt-5 grid gap-6 lg:grid-cols-2"><div className="aspect-[4/3] rounded-[1.25rem] bg-muted" /><div className="space-y-3"><div className="h-52 rounded-[1.25rem] bg-muted" /><div className="h-20 rounded-[1.25rem] bg-muted" /><div className="h-32 rounded-[1.25rem] bg-muted" /></div></div><span className="sr-only"><Loader2 />{t("detail.loadingSr")}</span></div>;
}
