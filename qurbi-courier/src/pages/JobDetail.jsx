import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle2, Clock, Flag, MapPin, MessageCircle, Navigation, Package, Phone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, EmptyState, ErrorNotice, PageHeader, StatusBadge } from "@/components/ui-kit";
import { StageStepper, STATUS_TONE, isActiveStatus } from "@/components/JobParts";
import { DeliverFlow, PickupFlow, ProblemFlow, TransitFlow } from "@/components/JobFlows";
import PrivateImage from "@/components/PrivateImage";
import { jobsApi } from "@/api/apiClient";
import { errorText, formatDateTime, formatMoney, joinAddress, mapsLink, telLink, wazeLink, whatsappLink } from "@/lib/format";
import { FullPageSpinner } from "@/components/ui-kit";

const STAGE_KEY = { pickup: "pickup", transit: "transit", delivery: "delivery", failed: "failed" };

export default function JobDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(["jobs", "proof", "common"]);
  const locale = i18n.language === "ms" ? "ms-MY" : "en-MY";
  const [job, setJob] = useState(null);
  const [state, setState] = useState({ loading: true, error: "", notFound: false });
  const [flow, setFlow] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releasing, setReleasing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJob(await jobsApi.detail(orderId));
      setState({ loading: false, error: "", notFound: false });
    } catch (error) {
      setState({ loading: false, error: error.status === 404 ? "" : errorText(error, t), notFound: error.status === 404 });
    }
  }, [orderId, t]);

  useEffect(() => { load(); }, [load]);

  const assignment = job?.assignment || null;
  const status = assignment?.status || null;
  const active = isActiveStatus(status);
  const order = job ? { orderId: job.orderId, orderNumber: job.orderNumber } : null;

  const finishFlow = (message) => {
    setFlow(null);
    if (message) toast({ title: message });
    load();
  };

  const accept = async () => {
    setAccepting(true);
    setActionError("");
    try {
      await jobsApi.accept(orderId);
      toast({ title: t("status.accepted", { ns: "jobs" }) });
      await load();
    } catch (error) {
      setActionError(errorText(error, t) || t("actions.acceptFailed", { ns: "jobs" }));
      // Someone else may have taken it; show the truth.
      load();
    } finally {
      setAccepting(false);
    }
  };

  const release = async () => {
    setReleasing(true);
    try {
      await jobsApi.release(orderId, releaseReason.trim() || undefined);
      navigate("/jobs", { replace: true });
    } catch (error) {
      setActionError(errorText(error, t));
      setReleaseOpen(false);
    } finally {
      setReleasing(false);
    }
  };

  if (state.loading) return <FullPageSpinner label={t("loading", { ns: "common" })} />;
  if (state.notFound) {
    return <EmptyState icon={Package} title={t("detail.notFound", { ns: "jobs" })} action={<Button asChild className="h-12"><Link to="/jobs">{t("title", { ns: "jobs" })}</Link></Button>} />;
  }
  if (state.error && !job) return <ErrorNotice message={state.error} onRetry={load} retryLabel={t("retry", { ns: "common" })} />;
  if (!job) return null;

  if (flow) {
    const props = { order, onCancel: () => setFlow(null), onSent: () => finishFlow(t("submit.sent", { ns: "proof" })), onQueued: () => finishFlow() };
    if (flow === "pickup") return <PickupFlow {...props} />;
    if (flow === "transit") return <TransitFlow {...props} />;
    if (flow === "deliver") return <DeliverFlow {...props} />;
    if (flow === "problem") return <ProblemFlow {...props} />;
  }

  const pickup = job.pickup;
  const destination = job.destination;
  const earning = assignment?.earningAmount ?? job.earning;
  const proofEvents = (job.events || []).filter((event) => event.images?.length);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        backTo="/jobs"
        title={`#${job.orderNumber}`}
        description={status ? undefined : t("detail.areaOnly", { ns: "jobs" })}
        actions={status ? <StatusBadge tone={STATUS_TONE[status]}>{t(`status.${status}`, { ns: "jobs" })}</StatusBadge> : null}
      />

      <ErrorNotice message={actionError} />

      {assignment && status !== "cancelled" && <Card><StageStepper status={status} /></Card>}

      {status === "failed" && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-extrabold text-destructive">{t("status.failed", { ns: "jobs" })}</p>
            <p className="mt-1 break-words">{assignment.failedReason}</p>
            {assignment.resolutionNote && <p className="mt-2 break-words text-muted-foreground">{assignment.resolutionNote}</p>}
          </div>
        </div>
      )}

      {active && (
        <Card className="border-primary/25" bodyClassName="bg-primary/[0.04]">
          <p className="text-base font-extrabold">{t(`actions.next.${status}`, { ns: "jobs" })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(`actions.next.${status}Hint`, { ns: "jobs" })}</p>
          <Button className="mt-4 h-14 w-full text-base" onClick={() => setFlow(status === "accepted" ? "pickup" : status === "picked_up" ? "transit" : "deliver")}>
            <Camera className="h-5 w-5" />
            {t(status === "accepted" ? "actions.startPickup" : status === "picked_up" ? "actions.startTransit" : "actions.startDelivery", { ns: "jobs" })}
          </Button>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setFlow("problem")}>
              <Flag className="h-4 w-4" />{t("actions.reportProblem", { ns: "jobs" })}
            </Button>
            {status === "accepted" && <Button variant="outline" className="h-11" onClick={() => setReleaseOpen(true)}>{t("actions.release", { ns: "jobs" })}</Button>}
          </div>
        </Card>
      )}

      {!assignment && (
        <Card>
          <Earning label={t("detail.earning", { ns: "jobs" })} amount={earning} approved={job.earningIsApprovedRate} />
          <Button className="mt-4 h-14 w-full text-base" onClick={accept} disabled={accepting}>
            {accepting ? t("actions.accepting", { ns: "jobs" }) : t("actions.accept", { ns: "jobs" })}
          </Button>
        </Card>
      )}

      {assignment && <Card><Earning label={t("detail.earning", { ns: "jobs" })} amount={earning} approved={job.earningIsApprovedRate} /></Card>}

      <Card title={t("detail.pickup", { ns: "jobs" })}>
        <Place
          title={pickup?.farmName || job.pickupArea?.farmName}
          lines={pickup ? [joinAddress(pickup.addressLine), joinAddress(pickup.postcode, pickup.city), pickup.state] : [joinAddress(job.pickupArea?.city, job.pickupArea?.state)]}
          target={pickup && { latitude: pickup.latitude, longitude: pickup.longitude, address: joinAddress(pickup.addressLine, pickup.city, pickup.postcode, pickup.state) }}
        />
        {job.contacts?.farmer?.phone && <Contact name={job.contacts.farmer.name} phone={job.contacts.farmer.phone} callLabel={t("detail.callFarmer", { ns: "jobs" })} />}
        {assignment && (status === "accepted" || status === "picked_up") && (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {assignment.farmerHandoverConfirmedAt ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{t("detail.farmerConfirmed", { ns: "jobs" })}</> : <><Clock className="h-4 w-4" aria-hidden="true" />{t("detail.farmerNotConfirmed", { ns: "jobs" })}</>}
          </p>
        )}
      </Card>

      <Card title={t("detail.dropoff", { ns: "jobs" })}>
        <Place
          title={destination?.recipientName || joinAddress(job.dropoffArea?.city, job.dropoffArea?.state)}
          lines={destination ? [joinAddress(destination.addressLine1, destination.addressLine2), joinAddress(destination.postcode, destination.city), destination.state] : [joinAddress(job.dropoffArea?.postcode, job.dropoffArea?.state)]}
          target={destination && { latitude: destination.latitude, longitude: destination.longitude, address: joinAddress(destination.addressLine1, destination.addressLine2, destination.city, destination.postcode, destination.state) }}
        />
        {job.contacts?.buyer?.phone && <Contact name={job.contacts.buyer.name} phone={job.contacts.buyer.phone} callLabel={t("detail.callBuyer", { ns: "jobs" })} whatsappText={`QURBI #${job.orderNumber}`} />}
        {job.distanceKm != null && <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("card.distance", { ns: "jobs", km: job.distanceKm })}</p>}
      </Card>

      <Card title={t("detail.items", { ns: "jobs" })}>
        <ul className="divide-y divide-border/60">
          {job.items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{[item.tagNumber && t("detail.tag", { ns: "jobs", tag: item.tagNumber }), item.weightKg && t("detail.weight", { ns: "jobs", kg: Number(item.weightKg) })].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="shrink-0 text-sm font-extrabold">{t("detail.quantity", { ns: "jobs", count: item.quantity })}</span>
            </li>
          ))}
        </ul>
      </Card>

      {proofEvents.length > 0 && (
        <Card title={t("detail.timeline", { ns: "jobs" })}>
          <div className="space-y-4">
            {proofEvents.map((event) => (
              <section key={event.id} aria-label={t(`stage.${STAGE_KEY[event.stage] || "pickup"}`, { ns: "proof" })}>
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold">
                  {t(`stage.${STAGE_KEY[event.stage] || "pickup"}`, { ns: "proof" })}
                  <span className="text-xs font-medium text-muted-foreground">{t("detail.photoTaken", { ns: "jobs", time: formatDateTime(event.capturedAt || event.createdAt, locale) })}</span>
                  {event.flags?.length > 0 && <StatusBadge tone="warning" icon={Flag}>{t("detail.flagged", { ns: "jobs" })}</StatusBadge>}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {event.images.map((url, index) => <PrivateImage key={url} src={url} alt={`${t(`stage.${STAGE_KEY[event.stage] || "pickup"}`, { ns: "proof" })} ${index + 1}`} className="aspect-square w-full rounded-xl" />)}
                </div>
              </section>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={releaseOpen} onOpenChange={(open) => { if (!releasing) setReleaseOpen(open); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
          <DialogHeader className="text-left">
            <DialogTitle>{t("actions.releaseTitle", { ns: "jobs" })}</DialogTitle>
            <DialogDescription>{t("actions.releaseBody", { ns: "jobs" })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="release-reason">{t("actions.releaseReason", { ns: "jobs" })}</Label>
            <Textarea id="release-reason" rows={3} maxLength={500} value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={() => setReleaseOpen(false)} disabled={releasing}>{t("cancel", { ns: "common" })}</Button>
            <Button variant="destructive" onClick={release} disabled={releasing}>{releasing ? t("actions.releasing", { ns: "jobs" }) : t("actions.releaseConfirm", { ns: "jobs" })}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Earning({ label, amount, approved }) {
  const { t } = useTranslation("jobs");
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-3xl font-extrabold tracking-tight text-primary">{formatMoney(amount)}</p>
      </div>
      <p className="max-w-[10rem] text-right text-xs text-muted-foreground">{approved ? t("detail.approvedRate") : t("detail.orderFee")}</p>
    </div>
  );
}

function Place({ title, lines, target }) {
  const { t } = useTranslation("jobs");
  const google = target ? mapsLink(target) : "";
  const waze = target ? wazeLink(target) : "";
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] font-extrabold">{title}</p>
        {lines.filter(Boolean).map((line) => <p key={line} className="break-words text-sm text-muted-foreground">{line}</p>)}
        {google && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <a href={google} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Navigation className="h-4 w-4" aria-hidden="true" />{t("detail.navigate")}</a>
            {waze && <a href={waze} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Waze</a>}
          </div>
        )}
      </div>
    </div>
  );
}

function Contact({ name, phone, callLabel, whatsappText }) {
  const { t } = useTranslation("jobs");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
      {name && <span className="mr-auto min-w-0 truncate text-sm font-semibold">{name}</span>}
      <a href={telLink(phone)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Phone className="h-4 w-4" aria-hidden="true" />{callLabel}</a>
      <a href={whatsappLink(phone, whatsappText)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle className="h-4 w-4" aria-hidden="true" />{t("detail.whatsapp")}</a>
    </div>
  );
}
