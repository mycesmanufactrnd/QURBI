import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/agri/BrandLogo";
import StatusBadge from "@/components/agri/StatusBadge";
import { Clock, LogOut, ShieldCheck } from "lucide-react";

export default function VerificationPending() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const status = user?.data?.verificationStatus || user?.verificationStatus;

  if (status === "Approved") return <Navigate to="/" replace />;
  if (status === "Not Submitted") return <Navigate to="/verify" replace />;
  if (status === "Rejected") return <Navigate to="/rejected" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent to-background flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 py-10">
        <div className="flex justify-center"><BrandLogo /></div>

        <div className="flex-1 flex flex-col justify-center animate-fade-in">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-100 text-amber-600 mb-6">
              <Clock className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Verification Submitted</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed text-sm">
              Your verification documents have been submitted successfully.
              Our admin team will review your account within 1–2 working days.
              Please wait until your account has been approved.
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Status</span>
              <StatusBadge tone="warning" dot>Pending Verification</StatusBadge>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                You cannot access the app until an admin approves your account. You'll be able to list livestock once approved.
              </p>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Application linked to {user?.email || "your signed-in email"}</p>
          </div>

          <button
            onClick={() => logout()}
            className="mt-8 w-full h-12 rounded-2xl border border-border bg-card font-semibold text-foreground flex items-center justify-center gap-2 hover:bg-muted"
          >
            <LogOut className="w-5 h-5" /> Log out
          </button>
        </div>
      </div>
    </div>
  );
}
