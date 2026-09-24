import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { farmerProfileApi, farmVerificationApi } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, UserCheck } from "lucide-react";
import BrandLogo from "@/components/agri/BrandLogo";
import DeliveryMethodCards from "@/components/agri/DeliveryMethodCards";
import DocUploader from "@/components/agri/DocUploader";
import StepIndicator from "@/components/agri/StepIndicator";
import { MALAYSIA_STATES, userVal } from "@/lib/agri";
import { getFarmerVerificationDraft, saveFarmerVerificationDraft } from "@/lib/farmerVerificationDraft";

const STEPS = [
  { n: 1, label: "Farm Details" },
  { n: 2, label: "Policy & Terms" },
];

const EMPTY_FORM = {
  name: "", phoneNumber: "", icNumber: "", farmName: "", address: "", city: "", postcode: "", state: "", deliveryPreference: "",
};

export default function FarmerVerification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const savedDraft = getFarmerVerificationDraft();
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: userVal(user, "name") || user?.full_name || "",
    ...(savedDraft?.form || {}),
  }));
  const [docs, setDocs] = useState(() => ({
    icFront: null,
    icBack: null,
    selfieImage: null,
    farmerCertificate: null,
    ...(savedDraft?.docs || {}),
  }));
  const [loading, setLoading] = useState(!savedDraft);
  const [error, setError] = useState("");

  useEffect(() => {
    if (savedDraft || !user?.id) {
      setLoading(false);
      return;
    }
    farmerProfileApi.byUser(user.id)
      .then(async (profile) => {
        const verificationPage = profile
          ? await farmVerificationApi.list({ page: 1, limit: 1 })
          : null;
        const verification = verificationPage?.data?.[0];
        const documents = verification?.documents || {};
        const personalDetails = documents.personalDetails || {};
        if (profile) {
          setForm({
            name: userVal(user, "name") || user?.full_name || "",
            phoneNumber: personalDetails.phoneNumber || "",
            icNumber: personalDetails.icNumber || "",
            farmName: profile.farmName || "",
            address: profile.farmAddressLine || "",
            city: profile.farmCity || "",
            postcode: profile.farmPostcode || "",
            state: profile.farmState || "",
            deliveryPreference: personalDetails.deliveryPreference || "",
          });
        }
        if (verification) {
          setDocs({
            icFront: documents.icFront || null,
            icBack: documents.icBack || null,
            selfieImage: documents.selfieImage || null,
            farmerCertificate: documents.farmerCertificate || null,
          });
        }
      })
      .catch(() => setError("Previous details could not be loaded. You can still complete this form."))
      .finally(() => setLoading(false));
  }, [savedDraft, user]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const valid = Boolean(
    form.name.trim() && form.phoneNumber.trim() && form.icNumber.trim() && form.farmName.trim()
    && form.address.trim() && form.city.trim() && form.postcode.trim() && form.state
    && form.deliveryPreference && docs.icFront && docs.icBack && docs.selfieImage
  );

  const next = () => {
    if (!valid) return;
    saveFarmerVerificationDraft({ form, docs });
    navigate("/verify/policy");
  };

  const status = userVal(user, "verificationStatus");
  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  if (status === "Rejected") return <Navigate to="/rejected" replace />;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/login")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <BrandLogo compact />
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><UserCheck className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Farmer Verification</h1>
            <p className="text-xs text-muted-foreground">Complete your farm details before reviewing the policy</p>
          </div>
        </div>

        <StepIndicator current={1} steps={STEPS} className="mt-5" />

        <div className="space-y-5 mt-6">
          <p className="text-xs text-muted-foreground"><span className="font-bold text-destructive">*</span> Required field</p>
          <Field label="Full Name" required><Input value={form.name} onChange={set("name")} placeholder="Ahmad bin Ali" className="h-12" /></Field>
          <Field label="Phone Number" required><Input value={form.phoneNumber} onChange={set("phoneNumber")} inputMode="tel" placeholder="01X-XXX XXXX" className="h-12" /></Field>
          <Field label="IC Number" required><Input value={form.icNumber} onChange={set("icNumber")} placeholder="XXXXXX-XX-XXXX" className="h-12" /></Field>
          <Field label="Farm Name" required><Input value={form.farmName} onChange={set("farmName")} placeholder="QURBI Livestock Farm" className="h-12" /></Field>
          <Field label="Farm Address" required><Input value={form.address} onChange={set("address")} placeholder="Lot 12, Jalan..." className="h-12" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" required><Input value={form.city} onChange={set("city")} placeholder="Kuantan" className="h-12" /></Field>
            <Field label="Postcode" required><Input value={form.postcode} onChange={set("postcode")} inputMode="numeric" placeholder="25000" className="h-12" /></Field>
          </div>
          <Field label="State" required>
            <Select value={form.state} onValueChange={(state) => setForm((current) => ({ ...current, state }))}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{MALAYSIA_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Delivery Method" required>
            <DeliveryMethodCards value={form.deliveryPreference} onChange={(deliveryPreference) => setForm((current) => ({ ...current, deliveryPreference }))} />
            <p className="text-xs text-muted-foreground">You can change this later from your profile.</p>
          </Field>

          <div className="space-y-3 pt-2">
            <DocUploader label="Front of IC" required value={docs.icFront} onChange={(icFront) => setDocs((current) => ({ ...current, icFront }))} />
            <DocUploader label="Back of IC" required value={docs.icBack} onChange={(icBack) => setDocs((current) => ({ ...current, icBack }))} />
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
              <DocUploader
                label="Selfie for Identity Verification"
                required
                capture="user"
                aspectClassName="mx-auto aspect-square max-w-[260px]"
                fittingType="fill"
                uploadLabel="Take a selfie"
                replaceLabel="Retake"
                hint="Use a clear, recent photo of your face. Superadmin will manually compare it with the front of your IC."
                value={docs.selfieImage}
                onChange={(selfieImage) => setDocs((current) => ({ ...current, selfieImage }))}
              />
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>• Face the camera directly in good lighting.</li>
                <li>• Remove sunglasses, mask or anything covering your face.</li>
                <li>• Only one person should appear in the photo.</li>
              </ul>
            </div>
            <DocUploader
              label="Farm Certificate (Optional)"
              hint="Not every farmer has a farm certificate. You may continue without it."
              value={docs.farmerCertificate}
              onChange={(farmerCertificate) => setDocs((current) => ({ ...current, farmerCertificate }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={next} disabled={!valid} className="w-full h-12 rounded-2xl text-base font-semibold">
            Next <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {!valid && <p className="text-center text-xs text-muted-foreground">Complete all required fields, both IC uploads and your selfie to continue.</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return <div className="space-y-1.5"><Label className="text-sm font-semibold">{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>{children}</div>;
}
