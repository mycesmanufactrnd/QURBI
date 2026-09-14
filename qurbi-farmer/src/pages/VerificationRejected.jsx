import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import BrandLogo from "@/components/agri/BrandLogo";
import StatusBadge from "@/components/agri/StatusBadge";
import { XCircle, LogOut, RefreshCw, Loader2 } from "lucide-react";

export default function VerificationRejected() {
  const navigate = useNavigate();
  const { user, logout, checkUserAuth } = useAuth();
  const status = user?.data?.verificationStatus || user?.verificationStatus;
  const [reapplying, setReapplying] = React.useState(false);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!user?.id) return;
    base44.entities.FarmVerification.filter({ userId: user.id }, "-created_date", 1)
      .then((rows) => setReason(rows?.[0]?.rejectionReason || "No reason was provided. Please contact QURBI support before resubmitting."))
      .catch(() => setReason("The rejection reason could not be loaded."));
  }, [user?.id]);

  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  if (status === "Not Submitted") return <Navigate to="/verify" replace />;

  const reapply = async () => {
    setReapplying(true);
    try {
      await base44.auth.updateMe({ verificationStatus: "Not Submitted" });
      await checkUserAuth();
      navigate("/verify", { replace: true });
    } catch {
      setReapplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-destructive/5 to-background flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 py-10">
        <div className="flex justify-center"><BrandLogo /></div>

        <div className="flex-1 flex flex-col justify-center animate-fade-in">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-100 text-red-600 mb-6">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Verification Rejected</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed text-sm">
              Your verification submission was not approved. Please review your documents
              and details, then submit again.
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Status</span>
              <StatusBadge tone="danger" dot>Rejected</StatusBadge>
            </div>
            <div className="mt-4 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-xs font-semibold text-destructive">Admin feedback</p>
              <p className="mt-1 text-sm leading-relaxed">{reason || "Loading feedback..."}</p>
            </div>
          </div>

          <button
            onClick={reapply}
            disabled={reapplying}
            className="mt-6 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-70"
          >
            {reapplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Re-submit Verification
          </button>

          <button
            onClick={() => logout()}
            className="mt-3 w-full h-12 rounded-2xl border border-border bg-card font-semibold text-foreground flex items-center justify-center gap-2 hover:bg-muted"
          >
            <LogOut className="w-5 h-5" /> Log out
          </button>
        </div>
      </div>
    </div>
  );
}
