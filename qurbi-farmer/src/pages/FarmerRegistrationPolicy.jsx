import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { farmVerificationApi, farmerProfileApi } from "@/api/farmerApi";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import SignaturePad from "@/components/agri/SignaturePad";
import StepIndicator from "@/components/agri/StepIndicator";
import { FARMER_POLICY_VERSION, userVal } from "@/lib/agri";
import { clearFarmerVerificationDraft, getFarmerVerificationDraft } from "@/lib/farmerVerificationDraft";

const STEPS = [{ n: 1, label: "Farm Details" }, { n: 2, label: "Policy & Terms" }];
const POLICY_POINTS = [
  { id: "identity-storage", title: "IC, selfie and document storage", text: "I consent to QURBI securely storing my IC, selfie and submitted documents for manual identity verification and account administration." },
  { id: "platform-markup", title: "20% platform markup", text: "I understand QURBI may add a 20% markup on top of the price I set for livestock displayed to buyers." },
  { id: "accurate-information", title: "Accurate information", text: "I confirm my personal, farm, livestock and pricing information is truthful, complete and kept up to date." },
  { id: "animal-compliance", title: "Animal health and legal compliance", text: "I am responsible for animal welfare and compliance with applicable Malaysian livestock, health, permit and movement requirements." },
  { id: "delivery-responsibility", title: "Delivery responsibility", text: "I will fulfil orders according to my selected delivery method and cooperate with QURBI where platform delivery is selected." },
  { id: "privacy-enforcement", title: "Privacy and platform enforcement", text: "I will protect buyer information and accept that QURBI may review, reject or suspend accounts that breach these terms." },
];

export default function FarmerRegistrationPolicy() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const draft = getFarmerVerificationDraft();
  const today = new Date().toISOString().slice(0, 10);
  const [accepted, setAccepted] = useState([]);
  const [name, setName] = useState(() => draft?.form?.name || userVal(user, "name") || user?.full_name || "");
  const [date, setDate] = useState(today);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const signatureRef = useRef(null);
  const submittingRef = useRef(false);
  const status = userVal(user, "verificationStatus");
  const draftReady = Boolean(
    draft?.form?.name?.trim() && draft?.form?.phoneNumber?.trim() && draft?.form?.icNumber?.trim()
    && draft?.form?.farmName?.trim() && draft?.form?.address?.trim() && draft?.form?.city?.trim()
    && draft?.form?.state && draft?.form?.postcode?.trim()
    && draft?.form?.deliveryPreference && draft?.docs?.icFront && draft?.docs?.icBack && draft?.docs?.selfieImage
  );

  useEffect(() => {
    if (!draftReady) navigate("/verify", { replace: true });
  }, [draftReady, navigate]);

  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  // Rejected farmers may prepare and submit a new verification attempt.
  if (!draftReady) return null;

  const allAccepted = POLICY_POINTS.every((point) => accepted.includes(point.id));
  const valid = Boolean(allAccepted && name.trim() && date && hasSignature);
  const toggle = (id, checked) => setAccepted((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));

  const submit = async () => {
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      let uploadedSignature = signatureUrl;
      if (!uploadedSignature) {
        const dataUrl = signatureRef.current?.toDataURL();
        const blob = await (await fetch(dataUrl)).blob();
        const upload = await base44.integrations.Core.UploadFile({ file: new File([blob], "farmer-registration-signature.png", { type: "image/png" }) });
        uploadedSignature = upload.file_url;
        if (!uploadedSignature) throw new Error("Signature upload failed.");
        setSignatureUrl(uploadedSignature);
      }

      const profilePayload = {
        farmName: draft.form.farmName.trim(),
        farmAddressLine: draft.form.address.trim(),
        farmCity: draft.form.city.trim(),
        farmState: draft.form.state,
        farmPostcode: draft.form.postcode.trim(),
      };
      const existingProfile = user?.farmerProfile || await farmerProfileApi.findByUserId(user.id);
      if (existingProfile?.id) {
        await farmerProfileApi.update(existingProfile.id, profilePayload);
      } else {
        await farmerProfileApi.create(profilePayload);
      }

      await farmVerificationApi.submit({
        signatureUrl: uploadedSignature,
        documents: {
          icFront: draft.docs.icFront,
          icBack: draft.docs.icBack,
          selfieImage: draft.docs.selfieImage,
          phoneNumber: draft.form.phoneNumber.trim(),
          icNumber: draft.form.icNumber.trim(),
          deliveryPreference: draft.form.deliveryPreference,
          policySignerName: name.trim(),
          policySignedDate: date,
          policyVersion: FARMER_POLICY_VERSION,
          policyConsents: POLICY_POINTS.map((point) => point.id),
          farmerCertificate: draft.docs.farmerCertificate || "",
        },
      });
      clearFarmerVerificationDraft();
      await checkUserAuth();
      navigate("/pending", { replace: true });
    } catch (submissionError) {
      setError(submissionError.response?.data?.error || submissionError.message || "Submission failed. Your details are saved on this device; please try again.");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/verify")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-extrabold tracking-tight">Policy &amp; Terms</h1>
        </div>
        <StepIndicator current={2} steps={STEPS} className="mt-4" />

        <div className="mt-6 rounded-2xl bg-accent border border-accent-foreground/20 p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-accent-foreground leading-relaxed">Please read and accept each policy point before signing your farmer registration.</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Policy version: {FARMER_POLICY_VERSION}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {POLICY_POINTS.map((point, index) => (
            <label key={point.id} className="flex items-start gap-3 rounded-2xl bg-card border border-border p-4 cursor-pointer">
              <Checkbox checked={accepted.includes(point.id)} onCheckedChange={(checked) => toggle(point.id, checked === true)} className="mt-0.5" />
              <span className="text-sm leading-relaxed"><strong>{index + 1}. {point.title}</strong><span className="block text-xs text-muted-foreground mt-1">{point.text}</span></span>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-card border border-border p-5 space-y-4">
          <h2 className="text-sm font-extrabold">Digital acknowledgement</h2>
          <div className="space-y-1.5"><Label>Full Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="h-12" /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="h-12" /></div>
          <div className="space-y-1.5"><Label>Signature</Label><SignaturePad ref={signatureRef} onInk={setHasSignature} /></div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 mt-5 pb-6">
          <Button variant="outline" onClick={() => navigate("/verify")} disabled={submitting} className="h-12 rounded-2xl flex-1">Back</Button>
          <Button onClick={submit} disabled={!valid || submitting} className="h-12 rounded-2xl flex-1">
            {submitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />} Submit Request
          </Button>
        </div>
        {!valid && <p className="-mt-3 pb-6 text-center text-xs text-muted-foreground">Accept every policy point, enter your name and date, then sign to submit.</p>}
      </div>
    </div>
  );
}
