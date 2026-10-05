import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { ArrowLeft, Loader2 } from "lucide-react";
import LivestockForm from "@/components/agri/LivestockForm";
import { useToast } from "@/components/ui/use-toast";
import { hasActivePaymentReservation, reservationExpiryLabel } from "@/lib/livestockReservation";
import { listingExpiry, marketplaceVisibility, newListingWindow } from "@/lib/agri";

export default function EditLivestock() {
  const { id } = useParams();
  const { t } = useTranslation("livestock");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [livestock, setLivestock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    qurbi.functions.invoke("checkLivestockReservation", { livestockId: id })
      .catch(() => null)
      .then(() => qurbi.entities.Livestock.get(id))
      .then(setLivestock)
      .catch(() => navigate("/livestock", { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      let update = data;
      if (listingExpiry(livestock).expired && data.status === "Available") {
        const now = new Date();
        update = { ...data, ...newListingWindow(now), listingRenewedAt: now.toISOString() };
        const visibility = marketplaceVisibility(update);
        update.marketplaceVisible = visibility.visible;
        update.marketplaceVisibilityReason = visibility.reason;
      }
      await qurbi.entities.Livestock.update(id, update);
      toast({ title: t("edit.toastSavedTitle"), description: listingExpiry(livestock).expired && data.status === "Available" ? t("edit.toastRenewed") : t("edit.toastUpdated") });
      navigate(`/livestock/${id}`, { replace: true });
    } catch (err) {
      toast({ title: t("edit.toastFailedTitle"), description: err.message || t("edit.toastFailedFallback"), variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }
  if (!livestock) return null;
  const listingExpired = livestock.status === "Available" && listingExpiry(livestock).expired;
  if (hasActivePaymentReservation(livestock)) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <button type="button" onClick={() => navigate(`/livestock/${id}`)} aria-label={t("edit.backAria")} className="soft-card flex h-11 w-11 items-center justify-center rounded-2xl"><ArrowLeft className="h-5 w-5" /></button>
        <div className="mt-6 rounded-3xl bg-amber-100/80 p-6 text-amber-950">
          <h1 className="text-xl font-extrabold">{t("edit.lockedTitle")}</h1>
          <p className="mt-2 text-sm leading-6">{t("edit.lockedText", { time: reservationExpiryLabel(livestock) })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} aria-label={t("edit.backAria")} className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("edit.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{listingExpired ? t("edit.descriptionRenew") : t("edit.descriptionNormal")}</p>
        </div>
      </div>
      <div className="mt-6">
        <LivestockForm initial={livestock} onSubmit={handleSubmit} submitting={submitting} submitLabel={listingExpired ? t("edit.submitRenew") : t("edit.submit")} />
      </div>
    </div>
  );
}
