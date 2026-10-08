import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, CalendarDays, MapPin, Pencil, RefreshCw, Scale, Trash2, Users } from "lucide-react";
import { qurbi } from "@/api/qurbiClient";
import { resolveApiAssetUrl } from "@/api/apiClient";
import ConfirmDialog from "@/components/agri/ConfirmDialog";
import StatusBadge from "@/components/agri/StatusBadge";
import StickyActionBar from "@/components/agri/StickyActionBar";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatMYR } from "@/lib/agri";
import { cn } from "@/lib/utils";

const dateFormat = (language) => new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric" });

export default function BulkListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("bulk");
  const { toast } = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (value, fallback = "—") => {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? dateFormat(i18n.language).format(new Date(time)) : fallback;
  };
  const numberLocale = i18n.language === "ms" ? "ms-MY" : "en-MY";

  const load = () => {
    setLoading(true);
    setLoadError("");
    qurbi.entities.BulkListing.get(id)
      .then(setItem)
      .catch((error) => setLoadError(error?.message || t("detail.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await qurbi.entities.BulkListing.delete(id);
      toast({ title: t("list.deletedToast") });
      navigate("/bulk", { replace: true });
    } catch (error) {
      toast({ title: t("list.deleteFailedToast"), description: error.message || t("list.tryAgain"), variant: "destructive" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!item) return (
    <div className="py-16 text-center">
      <AlertCircle className="mx-auto h-11 w-11 text-muted-foreground" />
      <p className="mt-3 text-lg font-extrabold">{t("detail.unavailable")}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError || t("detail.loadFailed")}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={() => navigate("/bulk")} className="min-h-11 rounded-2xl bg-card px-4 text-sm font-bold ring-1 ring-border">{t("detail.backToBulk")}</button>
        <button type="button" onClick={load} className="brand-gradient flex min-h-11 items-center gap-1.5 rounded-2xl px-4 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" />{t("detail.tryAgain")}</button>
      </div>
    </div>
  );

  const images = item.images?.length ? item.images : (item.coverImage ? [item.coverImage] : []);
  const videos = item.videos || [];
  const maleTotal = Number(item.maleCount || 0);
  const femaleTotal = Number(item.femaleCount || 0);
  const breakdown = item.breedBreakdown || [];
  const breakdownTotal = breakdown.reduce((sum, row) => sum + rowTotal(row), 0);
  const total = maleTotal + femaleTotal || breakdownTotal;
  // Older listings store the gender split only on the listing, not per breed group.
  const rowsHaveSplit = breakdown.some((row) => row.maleCount != null || row.femaleCount != null);
  const listingHasSplit = item.maleCount != null || item.femaleCount != null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl animate-fade-in overflow-x-hidden">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate("/bulk")} aria-label={t("detail.backAria")} className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("detail.eyebrow")}</p><h1 className="truncate text-xl font-extrabold tracking-tight">{t("detail.title")}</h1></div>
        </div>
        <button type="button" onClick={() => navigate(`/bulk/${id}/edit`)} aria-label={t("detail.editAria")} className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-secondary/70 px-3.5 text-sm font-bold text-primary"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">{t("detail.edit")}</span></button>
      </header>

      <div className="mt-5 grid min-w-0 grid-cols-1 items-start gap-5 pb-28 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,.92fr)] lg:gap-8 lg:pb-0">
        <div className="min-w-0 space-y-5">
          <section className="soft-card overflow-hidden p-2">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-[1rem] bg-muted sm:aspect-[16/11]">
              {images.length ? <Image src={images[activeImage]} fittingType="fill" alt={t("detail.photoAlt", { name: item.name, index: activeImage + 1 })} className="block h-full w-full max-w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("detail.noPhoto")}</div>}
            </div>
            {images.length > 1 && <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto p-1">{images.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={t("detail.showPhotoAria", { index: index + 1 })} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-card", index === activeImage ? "ring-primary" : "ring-transparent opacity-70")}><Image src={url} fittingType="fill" alt="" className="h-full w-full object-cover" /></button>)}</div>}
          </section>

          {videos.length > 0 && <section><h2 className="text-lg font-extrabold">{t("detail.videos")}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{videos.map((url, index) => <video key={`${url}-${index}`} src={resolveApiAssetUrl(url)} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-black" />)}</div></section>}
        </div>

        <div className="min-w-0 space-y-5">
          <section className="soft-card p-5 sm:p-6">
            <StatusBadge kind="bulk" status={item.status} dot />
            <h2 className="mt-3 break-words text-2xl font-extrabold leading-tight tracking-tight text-primary">{item.name}</h2>
            <div className="mt-3 flex items-baseline justify-between gap-3 rounded-2xl bg-muted/55 px-4 py-3">
              <p className="text-sm font-semibold text-muted-foreground">{t("detail.totalPrice")}</p>
              <p className="text-2xl font-extrabold text-foreground">{formatMYR(item.totalPrice)}</p>
            </div>
            {total > 0 && <p className="mt-2 text-right text-sm text-muted-foreground">{t("detail.perAnimal", { price: formatMYR(Math.round(Number(item.totalPrice) / total)) })}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2.5"><Count label={t("animalsLabel")} value={total} /><Count label={t("male")} value={listingHasSplit ? maleTotal : "—"} /><Count label={t("female")} value={listingHasSplit ? femaleTotal : "—"} /></div>
          </section>

          {item.description && (
            <section className="soft-card p-5">
              <h2 className="text-lg font-extrabold">{t("detail.about")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>
            </section>
          )}

          <section className="soft-card divide-y divide-border/60 overflow-hidden">
            {item.state && <InfoRow icon={MapPin} label={t("detail.state")} value={item.state} />}
            {item.estimatedWeightKg && <InfoRow icon={Scale} label={t("detail.estimatedWeight")} value={`${Number(item.estimatedWeightKg).toLocaleString(numberLocale)} kg`} />}
            {item.scheduledDate && <InfoRow icon={CalendarDays} label={t("detail.scheduledDate")} value={formatDate(item.scheduledDate)} />}
            {item.closesAt && <InfoRow icon={CalendarDays} label={t("detail.closesAt")} value={formatDate(item.closesAt)} />}
          </section>

          <section className="soft-card p-5">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="text-lg font-extrabold">{t("detail.breedBreakdown")}</h2></div>
            <div className="mt-4 divide-y divide-border/60">
              {breakdown.map((row, index) => (
                <BreedBreakdownRow
                  key={`${row.breed}-${index}`}
                  row={row}
                  species={row.species || item.species}
                  // A single breed group without its own split uses the listing's male/female counts.
                  fallbackSplit={!rowsHaveSplit && breakdown.length === 1 && listingHasSplit ? { male: maleTotal, female: femaleTotal } : null}
                />
              ))}
            </div>
            {!rowsHaveSplit && breakdown.length > 1 && listingHasSplit && (
              <p className="mt-3 rounded-xl bg-muted/55 px-3 py-2.5 text-sm text-muted-foreground"><Trans t={t} i18nKey="detail.acrossAll" values={{ male: maleTotal, female: femaleTotal }} components={[<span key="0" />, <strong key="1" className="text-foreground" />]} /></p>
            )}
          </section>
        </div>
      </div>

      <StickyActionBar>
        <button type="button" onClick={() => navigate(`/bulk/${id}/edit`)} className="brand-gradient flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white"><Pencil className="h-[18px] w-[18px]" />{t("detail.editListing")}</button>
        <button type="button" onClick={() => setConfirmDelete(true)} aria-label={t("detail.deleteAria")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card text-destructive ring-1 ring-destructive/30 hover:bg-destructive/10"><Trash2 className="h-5 w-5" /></button>
      </StickyActionBar>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={t("list.deleteTitle")} description={t("list.deleteDescription", { name: item.name })} confirmText={t("list.deleteConfirm")} destructive loading={deleting} onConfirm={remove} />
    </div>
  );
}

function rowTotal(row) {
  const hasSplit = row.maleCount != null || row.femaleCount != null;
  return hasSplit ? Number(row.maleCount || 0) + Number(row.femaleCount || 0) : Number(row.count || 0);
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/70 text-primary"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="break-words text-base font-bold">{value}</p></div>
    </div>
  );
}

function Count({ label, value }) {
  return <div className="rounded-2xl bg-muted/55 p-3 text-center"><p className="text-xl font-extrabold text-primary">{value}</p><p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}

function BreedBreakdownRow({ row, species, fallbackSplit }) {
  const { t } = useTranslation("bulk");
  const ownSplit = row.maleCount != null || row.femaleCount != null;
  const split = ownSplit ? { male: Number(row.maleCount || 0), female: Number(row.femaleCount || 0) } : fallbackSplit;
  const total = rowTotal(row);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="break-words text-base font-bold">{row.breed || t("detail.unspecified")}</p>{species && <p className="text-sm text-muted-foreground">{t(`species.${species}`, { defaultValue: species })}</p>}</div>
        <span className="shrink-0 rounded-full bg-secondary/70 px-3 py-1 text-sm font-extrabold text-primary">{t("detail.totalBadge", { count: total })}</span>
      </div>
      {split ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <p className="flex justify-between rounded-xl bg-muted/55 px-3 py-2"><span className="text-muted-foreground">{t("male")}</span> <strong className="text-foreground">{split.male}</strong></p>
          <p className="flex justify-between rounded-xl bg-muted/55 px-3 py-2"><span className="text-muted-foreground">{t("female")}</span> <strong className="text-foreground">{split.female}</strong></p>
        </div>
      ) : null}
    </div>
  );
}

function DetailSkeleton() {
  return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="aspect-[4/3] rounded-[1.5rem]" /><div className="space-y-4"><Skeleton className="h-44 rounded-[1.5rem]" /><Skeleton className="h-24 rounded-[1.5rem]" /><Skeleton className="h-52 rounded-[1.5rem]" /></div></div>;
}
