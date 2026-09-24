import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { farmVerificationApi, farmerProfileApi, livestockApi, uploadApi, userApi } from "@/api/apiClient";
import { Image } from "@/components/ui/image";
import { ArrowLeft, Check, ChevronRight, CreditCard, FileText, Home, Loader2, Mail, MapPin, PenLine, Phone, ShieldCheck, Truck, UserRoundCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/agri/EmptyState";
import CowSilhouetteIcon from "@/components/agri/CowSilhouetteIcon";
import StatusBadge from "@/components/agri/StatusBadge";
import { formatAge, formatMYR } from "@/lib/agri";

const STATUS_TONE = { Pending: "warning", Approved: "success", Rejected: "danger", "Not Submitted": "muted" };
const LIVESTOCK_TONE = { Available: "success", Reserved: "warning", Sold: "muted", Sick: "danger" };

export default function AdminFarmerReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [livestock, setLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  useEffect(() => {
    Promise.all([
      userApi.get(id),
      farmerProfileApi.byUser(id),
      livestockApi.list({ farmerId: id, page: 1, limit: 100 }),
    ]).then(async ([farmerRow, profileRow, livestockPage]) => {
      const verificationPage = profileRow
        ? await farmVerificationApi.list({ farmerProfileId: profileRow.id, page: 1, limit: 1 })
        : null;
      setFarmer(farmerRow);
      setProfile(profileRow || null);
      setVerification(verificationPage?.data?.[0] || null);
      setLivestock(livestockPage.data || []);
    }).catch(() => navigate("/admin/farmers", { replace: true })).finally(() => setLoading(false));
  }, [id, navigate]);

  const review = async () => {
    if (!decision || !verification) return;
    if (decision === "reject" && !reason.trim()) return;
    const documents = verification.documents || {};
    if (decision === "approve" && documents.selfieImage && !identityConfirmed) return;
    setActing(true);
    const approved = decision === "approve";
    try {
      const updated = await farmVerificationApi.review(verification.id, {
        approve: approved,
        ...(approved ? {} : { rejectionReason: reason.trim() }),
      });
      const backendStatus = approved ? "verified" : "rejected";
      setProfile((current) => ({ ...current, verificationStatus: backendStatus }));
      setVerification(updated);
      setDecision(null);
      setReason("");
      setIdentityConfirmed(false);
    } catch (error) {
      alert(error.message || "Review failed.");
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!farmer) return null;
  const name = farmer.fullName || "Unnamed farmer";
  const status = statusLabel(profile?.verificationStatus);
  const documents = verification?.documents || {};
  const personalDetails = documents.personalDetails || {};

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3"><button onClick={() => navigate("/admin/farmers")} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="text-xl font-extrabold tracking-tight">Farmer Details</h1><p className="text-xs text-muted-foreground">Profile, verification and livestock</p></div></div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">{name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><h2 className="truncate font-extrabold">{name}</h2><p className="truncate text-xs text-muted-foreground">{farmer.email}</p></div><StatusBadge tone={STATUS_TONE[status]} dot>{status}</StatusBadge></div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        <Row icon={Mail} label="Email" value={farmer.email} />
        <Row icon={CreditCard} label="IC Number" value={personalDetails.icNumber} />
        <Row icon={Phone} label="Phone" value={personalDetails.phoneNumber || farmer.phone} />
        <Row icon={Home} label="Farm Name" value={profile?.farmName} />
        <Row icon={MapPin} label="Farm Address" value={[profile?.farmAddressLine, profile?.farmCity, profile?.farmPostcode].filter(Boolean).join(", ")} />
        <Row icon={MapPin} label="State" value={profile?.farmState} />
        <Row icon={Truck} label="Delivery Method" value={personalDetails.deliveryPreference} />
      </div>

      {verification && (
        <>
          <section className="mt-5 rounded-2xl border border-primary/25 bg-primary/[0.035] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRoundCheck className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">Manual identity comparison</h2><StatusBadge tone={verification.reviewedAt ? "success" : "warning"} dot>{verification.reviewedAt ? "Reviewed" : "Awaiting review"}</StatusBadge></div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Compare the applicant's selfie with the face shown on the front of the IC before making a decision.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Document label="Front of IC" url={documents.icFront} /><Document label="Applicant selfie" url={documents.selfieImage} emptyLabel="No selfie (legacy submission)" /></div>
            {verification.reviewedAt && <p className="mt-3 text-xs text-muted-foreground">Reviewed on {new Date(verification.reviewedAt).toLocaleString("en-MY")}.</p>}
          </section>

          <section className="mt-5"><h2 className="mb-2 text-sm font-bold">Verification & Policy</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Document label="Back of IC" url={documents.icBack} /><Document label="Farm Certificate" url={documents.farmerCertificate} /><Document label="Digital Signature" url={verification.signatureUrl} /></div><div className="mt-3 rounded-2xl border border-border bg-card p-4"><div className="grid gap-3 sm:grid-cols-3"><Mini icon={PenLine} label="Signed by" value={documents.policySignerName} /><Mini icon={FileText} label="Signed date" value={documents.policySignedDate} /><Mini icon={ShieldCheck} label="Policy version" value={documents.policyVersion} /></div>{status === "Rejected" && verification.rejectionReason && <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3"><p className="text-[11px] font-bold text-destructive">Rejection reason</p><p className="mt-1 text-sm">{verification.rejectionReason}</p></div>}</div></section>
        </>
      )}

      {status === "Pending" && verification && <div className="mt-5 grid grid-cols-2 gap-3"><Button onClick={() => { setDecision("approve"); setReason(""); setIdentityConfirmed(false); }}><Check className="mr-2 h-4 w-4" />Approve</Button><Button variant="destructive" onClick={() => { setDecision("reject"); setReason(""); setIdentityConfirmed(false); }}><X className="mr-2 h-4 w-4" />Reject</Button></div>}

      <section className="mt-7"><div className="flex items-end justify-between"><div><h2 className="text-lg font-extrabold">Livestock</h2><p className="text-xs text-muted-foreground">{livestock.length} listing{livestock.length === 1 ? "" : "s"} by this farmer</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{livestock.length ? livestock.map((item) => <button key={item.id} onClick={() => navigate(`/admin/livestock/${item.id}`)} className="overflow-hidden rounded-2xl border border-border bg-card text-left transition-shadow hover:shadow-sm"><div className="aspect-video bg-muted">{item.coverImage || item.images?.[0] ? <Image src={item.coverImage || item.images[0]} fittingType="fill" className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><CowSilhouetteIcon className="h-7 w-7" /></div>}</div><div className="p-3"><div className="flex items-center justify-between gap-2"><StatusBadge tone={LIVESTOCK_TONE[item.status]} dot>{item.status}</StatusBadge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Species</p><p className="truncate text-lg font-extrabold leading-tight text-primary">{item.species}</p><p className="mt-1 truncate text-xs"><span className="font-bold uppercase tracking-wide text-muted-foreground">Breed</span> <span className="font-semibold text-foreground">{item.breed}</span></p><p className="text-xs text-muted-foreground">{formatAge(item)} · {item.gender}</p><p className="mt-1 text-sm font-extrabold text-primary">{formatMYR(item.price)}</p></div></button>) : <EmptyState icon={CowSilhouetteIcon} title="No livestock" description="This farmer has not created any livestock listings." />}</div></section>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) { setDecision(null); setReason(""); setIdentityConfirmed(false); } }}><DialogContent className="max-w-md rounded-3xl"><DialogHeader><DialogTitle>{decision === "approve" ? "Approve" : "Reject"} farmer verification</DialogTitle></DialogHeader><div className="space-y-3">{decision === "approve" && documents.selfieImage && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.035] p-3"><Checkbox checked={identityConfirmed} onCheckedChange={(checked) => setIdentityConfirmed(checked === true)} className="mt-0.5" /><span className="text-xs leading-relaxed">I compared the applicant selfie with the front of the IC and confirm they appear to belong to the same person.</span></label>}{decision === "reject" && <><Label>Reason shown to farmer *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain why this verification is rejected..." /></>}<Button onClick={review} disabled={acting || (decision === "reject" && !reason.trim()) || (decision === "approve" && documents.selfieImage && !identityConfirmed)} variant={decision === "approve" ? "default" : "destructive"} className="w-full">{acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm {decision === "approve" ? "approval" : "rejection"}</Button></div></DialogContent></Dialog>
    </div>
  );
}

function Row({ icon: Icon, label, value }) { return <div className="flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold">{value || "—"}</p></div></div>; }
function Mini({ icon: Icon, label, value }) { return <div><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p><p className="mt-1 text-sm font-semibold">{value || "—"}</p></div>; }
function Document({ label, url, emptyLabel = "Not provided" }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!url) { setPreviewUrl(""); return undefined; }
    if (!String(url).startsWith("/uploads/private/")) { setPreviewUrl(url); return undefined; }
    uploadApi.getPrivateFile(url).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    }).catch(() => setPreviewUrl(""));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <div><p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileText className="h-3.5 w-3.5" />{label}</p>{url ? (previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="block aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-muted"><Image src={previewUrl} fittingType="fit" className="h-full w-full" /></a> : <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-border bg-muted text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading secure file...</div>) : <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-dashed border-border px-3 text-center text-xs text-muted-foreground">{emptyLabel}</div>}</div>;
}

function statusLabel(status) {
  return { pending: "Pending", verified: "Approved", rejected: "Rejected", unverified: "Not Submitted" }[status] || "Not Submitted";
}
