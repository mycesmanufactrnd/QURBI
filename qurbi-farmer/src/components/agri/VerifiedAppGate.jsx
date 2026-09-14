import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { userVal } from "@/lib/agri";
import { Loader2 } from "lucide-react";

// Gates the main farmer app: only approved farmers (role "user") may enter.
// Admins are redirected to admin mode; unverified farmers to the right step.
export default function VerifiedAppGate() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const status = userVal(user, "verificationStatus");
  if (status === "Approved") return <Outlet />;
  if (status === "Pending") return <Navigate to="/pending" replace />;
  if (status === "Rejected") return <Navigate to="/rejected" replace />;
  // Not Submitted → go to verification form
  return <Navigate to="/verify" replace />;
}