import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import SignaturePad from "@/components/agri/SignaturePad";
import StepIndicator from "@/components/agri/StepIndicator";
import ReviewSummary from "@/components/agri/ReviewSummary";
import { marketplaceVisibility, newListingWindow, SELLER_POLICY_VERSION, userVal } from "@/lib/agri";
import { getDraft, clearDraft } from "@/lib/livestockDraft";

export default function LivestockPolicy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = getDraft();

  // Redirect to step 1 if there's no draft (direct navigation / refresh).
  useEffect(() => {
    if (!draft) navigate("/livestock/add", { replace: true });
  }, [draft, navigate]);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(() => draft?.policySignerName || userVal(user, "name") || user?.full_name || "");
  const [date, setDate] = useState(today);
  const [agreed, setAgreed] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedSignatureUrl, setSavedSignatureUrl] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const sigRef = useRef(null);
  // Hard guard against duplicate submission (double-click / retry races).
  const submittingRef = useRef(false);

  // Delivery method lives on the farmer's profile (not the listing draft).
  useEffect(() => {
    if (!user?.id) return;
    qurbi.entities.FarmerProfile.filter({ userId: user.id })
      .then((rows) => setDeliveryMethod(rows?.[0]?.deliveryPreference || ""))
      .catch(() => {});
  }, [user?.id]);

  const valid = name.trim() && date && hasSig && agreed;

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setSubmitting(true);
    try {
      // Upload the signature once; reuse the URL on retry if the upload
      // already succeeded but the create failed.
      let signatureUrl = savedSignatureUrl;
      if (!signatureUrl) {
        const dataUrl = sigRef.current?.toDataURL();
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "signature.png", { type: "image/png" });
        const res = await qurbi.integrations.Core.UploadFile({ file });
        signatureUrl = res.file_url;
        setSavedSignatureUrl(signatureUrl);
      }

      // Keep legacy draft-only fields out and omit null values that are not
      // accepted by the additive Base44 entity schema.
      const { markupConsent, ...draftData } = draft;
      let reviewAwareData = draftData;
      if (draftData.speciesRequestId) {
        const request = await qurbi.entities.SpeciesRequest.get(draftData.speciesRequestId).catch(() => null);
        if (request?.status === "Approved") {
          reviewAwareData = {
            ...reviewAwareData,
            species: request.proposedName,
            speciesApprovalStatus: "Approved",
          };
        } else if (request?.status === "Rejected") {
          reviewAwareData = {
            ...reviewAwareData,
            speciesApprovalStatus: "Rejected",
          };
        }
      }
      if (draftData.breedRequestId) {
        const request = await qurbi.entities.BreedRequest.get(draftData.breedRequestId).catch(() => null);
        if (request?.status === "Approved") {
          const approvedBreeds = await qurbi.entities.Breed.filter({
            species: request.species,
            name: request.proposedName,
          }).catch(() => []);
          reviewAwareData = {
            ...reviewAwareData,
            breed: request.proposedName,
            breedId: approvedBreeds?.[0]?.id || "",
            breedApprovalStatus: "Approved",
          };
        } else if (request?.status === "Rejected") {
          reviewAwareData = {
            ...reviewAwareData,
            breed: "Unspecified",
            breedId: "",
            breedApprovalStatus: "Rejected",
          };
        }
      }
      const listingWindow = newListingWindow();
      reviewAwareData = { ...reviewAwareData, ...listingWindow };
      const visibility = marketplaceVisibility(reviewAwareData);
      reviewAwareData = {
        ...reviewAwareData,
        marketplaceVisible: visibility.visible,
        marketplaceVisibilityReason: visibility.reason,
      };
      const livestockData = Object.fromEntries(
        Object.entries(reviewAwareData).filter(([, value]) => value !== null && value !== undefined)
      );
      await qurbi.entities.Livestock.create({
        ...livestockData,
        ownerId: user.id,
        policySignerName: name.trim(),
        policySignedDate: date,
        policySignature: signatureUrl,
        policyVersion: SELLER_POLICY_VERSION,
        policyAcceptedAt: new Date().toISOString(),
      });

      clearDraft();
      navigate("/livestock", { replace: true });
    } catch (err) {
      // Keep all entered data + the signature so the farmer can retry.
      setError(err.message || "Submission failed. Please try again.");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  if (!draft) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/livestock/add")}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">Seller Policy</h1>
      </div>

      <StepIndicator current={2} className="mt-4" />

      <div className="mt-6 rounded-2xl bg-accent border border-accent-foreground/20 p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-accent-foreground leading-relaxed">Please review this policy before signing and submitting your livestock listing.</p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Policy version: {SELLER_POLICY_VERSION}</p>
        </div>
      </div>

      {/* Policy body */}
      <div className="mt-4 rounded-2xl bg-card border border-border p-5 space-y-4">
        <h2 className="text-sm font-extrabold tracking-tight">Seller Policy</h2>
        <p className="text-xs text-muted-foreground">By submitting this listing, I confirm and agree on behalf of my farm:</p>
        <ol className="space-y-3 text-sm leading-relaxed text-foreground list-decimal pl-4">
          <li><span className="font-semibold">Accurate livestock information</span> — All details (species, breed, age, colour, state, feed, photos and videos) are truthful and current to the best of my knowledge.</li>
          <li><span className="font-semibold">Animal health &amp; Malaysian legal/permit compliance</span> — Animals comply with Malaysian livestock, health, and movement regulations, including required permits and veterinary standards.</li>
          <li><span className="font-semibold">Pricing, availability &amp; order responsibility</span> — I set my own prices, keep availability accurate, and am responsible for honouring accepted orders.</li>
          <li><span className="font-semibold">Delivery responsibility</span> — I will fulfil delivery per my selected delivery method and ensure safe handover to the buyer.</li>
          <li><span className="font-semibold">Buyer privacy, fraud &amp; account enforcement</span> — I will protect buyer information, not engage in fraudulent activity, and understand QURBI may suspend accounts that breach this policy.</li>
        </ol>
      </div>

      {/* Signer details */}
      <div className="mt-4 rounded-2xl bg-card border border-border p-5 space-y-4">
        <h2 className="text-sm font-extrabold tracking-tight">Sign &amp; confirm</h2>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Date</Label>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-12"
          />
          <p className="text-[11px] text-muted-foreground">Future dates are not allowed.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Signature</Label>
          <SignaturePad ref={sigRef} onInk={setHasSig} />
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-accent p-3 cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
          <span className="text-xs text-accent-foreground leading-relaxed">
            I have read and agree to the Seller Policy and confirm all information is accurate.
          </span>
        </label>
      </div>

      {/* Review summary (no sensitive documents) */}
      <div className="mt-4">
        <ReviewSummary
          species={draft?.species}
          breed={draft?.breed}
          price={draft?.price}
          farmLocation={draft?.state || draft?.farmLocation}
          deliveryMethod={deliveryMethod}
          signerName={name}
          signedDate={date}
        />
      </div>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      <div className="mt-6 pb-2">
        <div className="soft-card flex gap-3 rounded-2xl p-3">
          <Button variant="outline" onClick={() => navigate("/livestock/add")} className="h-12 rounded-2xl flex-1" disabled={submitting}>
            Back
          </Button>
          <Button onClick={submit} disabled={!valid || submitting} className="h-12 rounded-2xl text-base font-semibold flex-1">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Submit Listing
          </Button>
        </div>
      </div>
    </div>
  );
}
