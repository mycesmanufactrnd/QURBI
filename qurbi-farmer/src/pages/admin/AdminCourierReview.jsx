import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { courierApi } from "@/api/apiClient";
import {
  AlertCircle, BadgeCheck, BadgeDollarSign, Bike, Check, Clock, CreditCard, Landmark, Loader2, Mail, MapPin, Pause, Phone,
  Play, Star, Truck, UserRound, X, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import EmptyState from "@/components/agri/EmptyState";
import StatusBadge from "@/components/agri/StatusBadge";
import { AdminCard, AdminPageHeader, InfoItem, StickyActionBar } from "@/components/admin/AdminUi";
import DocumentThumb from "@/components/admin/DocumentThumb";
import { courierStandingInfo, formatDate, formatDateTime, formatPrice, titleCase } from "@/components/admin/adminFormat";
import { cn } from "@/lib/utils";

// One dialog drives every admin decision; `kind` picks the copy and the call.
const DECISIONS = {
  approve: { title: "Approve", confirm: "Confirm approval", description: "The courier can go online and accept delivery jobs straight away." },
  reject: { title: "Reject", confirm: "Confirm rejection", description: "The courier will see your reason and can fix and resubmit their documents.", reason: "Reason shown to the courier", placeholder: "e.g. The licence photo is blurry — please upload a clearer picture." },
  suspend: { title: "Suspend", confirm: "Suspend courier", description: "They are taken offline and blocked from every job right away. Jobs already in progress stay assigned to them until you reassign.", reason: "Reason shown to the courier", placeholder: "e.g. Complaint under review." },
  reactivate: { title: "Reactivate", confirm: "Reactivate courier", description: "The courier can go online and accept jobs again." },
  rateApprove: { title: "Approve delivery rate for", confirm: "Approve rate", description: "New jobs they accept will pay this amount per delivery. Jobs already accepted keep their old amount." },
  rateReject: { title: "Reject delivery rate for", confirm: "Reject rate", description: "Their previous approved rate stays in force.", reason: "Reason shown to the courier", placeholder: "e.g. RM 25 is above our standard rate for this distance." },
};

export default function AdminCourierReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [approvedFee, setApprovedFee] = useState("");

  const load = useCallback(() => courierApi.adminGet(id)
    .then(setCourier)
    .catch(() => navigate("/admin/couriers", { replace: true }))
    .finally(() => setLoading(false)), [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const openDecision = (kind) => {
    setDecision(kind);
    setReason("");
    setReasonTouched(false);
    setIdentityConfirmed(false);
    setApprovedFee(kind === "rateApprove" ? String(courier?.proposedFee ?? "") : "");
  };

  const closeDecision = () => {
    if (acting) return;
    setDecision(null);
  };

  const latest = courier?.verifications?.[0] || null;
  const copy = decision ? DECISIONS[decision] : null;
  const feeNumber = Number(approvedFee);
  const feeInvalid = decision === "rateApprove" && (!Number.isFinite(feeNumber) || feeNumber < 1 || feeNumber > 1000);
  const reasonRequired = Boolean(copy?.reason);
  const reasonError = reasonRequired && reasonTouched && !reason.trim();
  const needsIdentityCheck = decision === "approve" && Boolean(latest?.documents?.selfie);
  const confirmDisabled = acting || (reasonRequired && !reason.trim()) || feeInvalid || (needsIdentityCheck && !identityConfirmed);

  const submitDecision = async () => {
    if (!decision) return;
    if (reasonRequired && !reason.trim()) { setReasonTouched(true); return; }
    setActing(true);
    try {
      if (decision === "approve") await courierApi.review(latest.id, { approve: true });
      else if (decision === "reject") await courierApi.review(latest.id, { approve: false, rejectionReason: reason.trim() });
      else if (decision === "suspend") await courierApi.suspend(id, reason.trim());
      else if (decision === "reactivate") await courierApi.reactivate(id);
      else if (decision === "rateApprove") await courierApi.reviewRate(id, { approve: true, approvedFee: Number(feeNumber.toFixed(2)) });
      else if (decision === "rateReject") await courierApi.reviewRate(id, { approve: false, reason: reason.trim() });
      await load();
      setDecision(null);
      toast({ title: RESULT_TOAST[decision], description: "The courier has been notified." });
    } catch (error) {
      toast({ variant: "destructive", title: "That did not work", description: error.message || "Please try again." });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <ReviewSkeleton />;
  if (!courier) return null;

  const name = courier.user?.fullName || "Unnamed courier";
  const standing = courierStandingInfo(courier.verificationStatus);
  const documents = latest?.documents || {};
  const isPending = courier.verificationStatus === "pending" && Boolean(latest);
  const isApproved = courier.verificationStatus === "approved";
  const isSuspended = courier.verificationStatus === "suspended";
  const areas = (courier.serviceAreas || []).map((area) => (area.districts?.length ? `${area.state} (${area.districts.join(", ")})` : area.state)).join("; ");
  const rateRequested = courier.rateStatus === "pending" && courier.proposedFee;

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        backTo="/admin/couriers"
        backLabel="Back to couriers"
        eyebrow="Courier review"
        title={<span className="block break-words">{name}</span>}
        description={[courier.vehicleType && titleCase(courier.vehicleType), courier.vehiclePlate].filter(Boolean).join(" · ") || courier.user?.email}
        actions={<StatusBadge tone={standing.tone} dot className="hidden sm:inline-flex">{standing.label}</StatusBadge>}
      />

      <StatusBanner className="mt-4" courier={courier} latest={latest} isPending={isPending} isApproved={isApproved} isSuspended={isSuspended} standing={standing} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
        <div className="min-w-0 space-y-5">
          {latest ? (
            <>
              <AdminCard
                title="Identity check"
                description="Does the selfie match the face on the IC, and do the details match the application?"
                action={<StatusBadge tone={latest.reviewedAt ? "success" : "warning"} dot className="shrink-0">{latest.reviewedAt ? "Reviewed" : "To check"}</StatusBadge>}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-muted/45 p-3.5 sm:grid-cols-3">
                  <InfoItem icon={UserRound} label="Name on account" value={name} className="col-span-2 sm:col-span-1" />
                  <InfoItem icon={CreditCard} label="IC number" value={courier.icNumber} mono />
                  <InfoItem icon={Phone} label="Phone" value={courier.user?.phone} mono />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <DocumentThumb label="Front of IC" url={documents.icFront} />
                  <DocumentThumb label="Courier selfie" url={documents.selfie} />
                </div>
                {latest.reviewedAt && <p className="mt-3 text-xs text-muted-foreground">Reviewed on {formatDateTime(latest.reviewedAt)}.</p>}
              </AdminCard>

              <AdminCard title="Supporting documents" description="Tap a document to view it full size.">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <DocumentThumb label="Back of IC" url={documents.icBack} />
                  <DocumentThumb label="Driving licence" url={documents.licence} />
                </div>
                <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">Submitted {formatDateTime(latest.submittedAt || latest.createdAt)}.</p>
              </AdminCard>

              {courier.verifications.length > 1 && (
                <AdminCard title="Earlier submissions" description="Kept as an audit trail when a courier resubmits.">
                  <ul className="divide-y divide-border/60">
                    {courier.verifications.slice(1).map((item) => {
                      const info = courierStandingInfo(item.status);
                      return (
                        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                          <span className="text-sm font-semibold">{formatDate(item.submittedAt || item.createdAt)}</span>
                          <span className="flex min-w-0 items-center gap-2">
                            {item.rejectionReason && <span className="min-w-0 truncate text-xs text-muted-foreground">{item.rejectionReason}</span>}
                            <StatusBadge tone={info.tone} dot className="shrink-0">{info.short}</StatusBadge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </AdminCard>
              )}
            </>
          ) : (
            <EmptyState icon={Bike} title="No documents submitted" description="This courier has registered but not sent their identity documents yet. They will appear here for review once submitted." />
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <AdminCard title="Contact & vehicle">
            <dl className="grid gap-3.5">
              <DetailRow icon={Mail} label="Email" value={courier.user?.email} />
              <DetailRow icon={Phone} label="Phone" value={courier.user?.phone} />
              <DetailRow icon={Truck} label="Vehicle" value={[titleCase(courier.vehicleType), courier.vehiclePlate].filter(Boolean).join(" · ")} />
              <DetailRow icon={MapPin} label="Service area" value={areas} />
              <DetailRow icon={Landmark} label="Bank" value={[courier.bankName, courier.bankAccountNo, courier.bankAccountHolder].filter(Boolean).join(" · ")} />
            </dl>
          </AdminCard>

          <AdminCard
            title="Delivery rate"
            description="What this courier earns for each delivery they complete."
            action={rateRequested ? <StatusBadge tone="warning" dot className="shrink-0">Request pending</StatusBadge> : null}
          >
            <div className="grid grid-cols-2 gap-3">
              <InfoItem icon={BadgeDollarSign} label="Approved rate" value={courier.approvedFee ? formatPrice(courier.approvedFee) : "None yet"} />
              <InfoItem icon={BadgeDollarSign} label="Last requested" value={courier.proposedFee ? formatPrice(courier.proposedFee) : "—"} />
            </div>
            {!courier.approvedFee && <p className="mt-3 text-xs text-muted-foreground">Until a rate is approved, jobs pay the order's delivery fee.</p>}
            {courier.rateStatus === "rejected" && courier.rateRejectionReason && (
              <p className="mt-3 break-words rounded-xl bg-destructive/5 p-3 text-sm"><span className="font-semibold">Last request rejected: </span>{courier.rateRejectionReason}</p>
            )}
            {rateRequested && (
              <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50 p-3.5">
                <p className="text-sm font-extrabold text-amber-900">Asks for {formatPrice(courier.proposedFee)} per delivery</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-11 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => openDecision("rateReject")}><X className="h-4 w-4" />Reject</Button>
                  <Button className="h-11" onClick={() => openDecision("rateApprove")}><Check className="h-4 w-4" />Approve</Button>
                </div>
              </div>
            )}
          </AdminCard>

          <AdminCard title="Performance">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem icon={Bike} label="Deliveries completed" value={String(courier.totalDeliveries || 0)} />
              <InfoItem icon={Star} label="Rating" value={courier.ratingCount ? `${Number(courier.ratingAverage).toFixed(1)} (${courier.ratingCount})` : "No ratings yet"} />
            </div>
          </AdminCard>

          {courier.audit?.length > 0 && (
            <AdminCard title="Admin activity" description="Every decision on this account, newest first.">
              <ul className="space-y-2.5">
                {courier.audit.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <span className="font-bold">{titleCase(entry.action)}</span>
                    <span className="text-muted-foreground"> · {formatDateTime(entry.createdAt)}</span>
                    {entry.detail?.reason && <p className="mt-0.5 break-words text-xs text-muted-foreground">{entry.detail.reason}</p>}
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}
        </div>
      </div>

      {(isPending || isApproved || isSuspended) && (
        <StickyActionBar label="Courier decision">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-foreground sm:pl-1">
              {isPending && <><span className="font-extrabold">Decision needed.</span> <span className="text-muted-foreground">Check the IC, selfie and licence first.</span></>}
              {isApproved && <><span className="font-extrabold">Active courier.</span> <span className="text-muted-foreground">Suspend to take them offline immediately.</span></>}
              {isSuspended && <><span className="font-extrabold">Suspended.</span> <span className="text-muted-foreground">Reactivate to let them take jobs again.</span></>}
            </p>
            <div className="grid grid-cols-[1fr_1.4fr] gap-2 sm:flex sm:shrink-0">
              {isPending && (
                <>
                  <Button variant="outline" className="h-12 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive sm:px-6" onClick={() => openDecision("reject")}><X className="h-4 w-4" />Reject</Button>
                  <Button className="h-12 sm:px-8" onClick={() => openDecision("approve")}><Check className="h-4 w-4" />Approve courier</Button>
                </>
              )}
              {isApproved && <Button variant="outline" className="col-span-2 h-12 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive sm:px-8" onClick={() => openDecision("suspend")}><Pause className="h-4 w-4" />Suspend courier</Button>}
              {isSuspended && <Button className="col-span-2 h-12 sm:px-8" onClick={() => openDecision("reactivate")}><Play className="h-4 w-4" />Reactivate courier</Button>}
            </div>
          </div>
        </StickyActionBar>
      )}

      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) closeDecision(); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl">
          {copy && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle>{copy.title} {name}?</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {needsIdentityCheck && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.035] p-3">
                    <Checkbox checked={identityConfirmed} onCheckedChange={(checked) => setIdentityConfirmed(checked === true)} className="mt-0.5" />
                    <span className="text-sm leading-relaxed">I compared the selfie with the front of the IC and confirm they appear to belong to the same person, and that the licence is valid.</span>
                  </label>
                )}
                {decision === "rateApprove" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="approved-fee">Approved rate per delivery (RM)</Label>
                    <Input id="approved-fee" inputMode="decimal" value={approvedFee} onChange={(event) => setApprovedFee(event.target.value)} aria-invalid={feeInvalid} className={cn(feeInvalid && "border-destructive focus-visible:ring-destructive")} />
                    <p className={cn("text-xs", feeInvalid ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {feeInvalid ? "Enter an amount between RM 1 and RM 1,000." : `They asked for ${formatPrice(courier.proposedFee)}. You can approve a different amount.`}
                    </p>
                  </div>
                )}
                {reasonRequired && (
                  <div className="space-y-1.5">
                    <Label htmlFor="decision-reason">{copy.reason} <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="decision-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      onBlur={() => setReasonTouched(true)}
                      rows={4}
                      aria-invalid={reasonError}
                      aria-describedby="decision-reason-help"
                      placeholder={copy.placeholder}
                      className={cn(reasonError && "border-destructive focus-visible:ring-destructive")}
                    />
                    <p id="decision-reason-help" className={cn("text-xs", reasonError ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {reasonError ? "A reason is required." : "Be specific so the courier knows what to do next."}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button variant="outline" onClick={closeDecision} disabled={acting}>Cancel</Button>
                  <Button onClick={submitDecision} disabled={confirmDisabled} variant={["reject", "suspend", "rateReject"].includes(decision) ? "destructive" : "default"}>
                    {acting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {copy.confirm}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RESULT_TOAST = {
  approve: "Courier approved",
  reject: "Verification rejected",
  suspend: "Courier suspended",
  reactivate: "Courier reactivated",
  rateApprove: "Delivery rate approved",
  rateReject: "Delivery rate rejected",
};

function StatusBanner({ courier, latest, isPending, isApproved, isSuspended, standing, className }) {
  if (isPending) {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-3.5 text-amber-900", className)}>
        <Clock className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 text-sm">
          <p className="font-extrabold">Waiting for your decision</p>
          <p className="mt-0.5 leading-5">Submitted {formatDate(latest?.submittedAt || latest?.createdAt, "recently")}. Compare the IC with the selfie, check the licence, then approve or reject.</p>
        </div>
      </div>
    );
  }
  if (isApproved) {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-900", className)}>
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm"><span className="font-extrabold">Approved courier.</span> {latest?.reviewedAt ? `Approved on ${formatDate(latest.reviewedAt)}.` : ""} {courier.isOnline ? "Currently online." : "Currently offline."}</p>
      </div>
    );
  }
  if (isSuspended) {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5", className)}>
        <Pause className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 text-sm">
          <p className="font-extrabold text-destructive">Suspended</p>
          {courier.suspensionReason && <p className="mt-1 break-words text-foreground"><span className="font-semibold">Reason: </span>{courier.suspensionReason}</p>}
        </div>
      </div>
    );
  }
  if (courier.verificationStatus === "rejected") {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5", className)}>
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 text-sm">
          <p className="font-extrabold text-destructive">Rejected{latest?.reviewedAt ? ` on ${formatDate(latest.reviewedAt)}` : ""}</p>
          {latest?.rejectionReason && <p className="mt-1 break-words text-foreground"><span className="font-semibold">Reason given: </span>{latest.rejectionReason}</p>}
          <p className="mt-1 text-xs text-muted-foreground">The courier can resubmit; it will return here as pending.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-3.5", className)}>
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <p className="text-sm"><span className="font-extrabold">{standing.label}.</span> Nothing to review until the courier submits their documents.</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-bold text-foreground">{value || "—"}</dd>
      </div>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className="h-14 w-64 rounded-2xl bg-muted" />
      <div className="mt-4 h-16 rounded-2xl bg-muted" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="h-80 rounded-[1.25rem] bg-muted" />
        <div className="h-80 rounded-[1.25rem] bg-muted" />
      </div>
      <span className="sr-only">Loading courier</span>
    </div>
  );
}
