import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

// Hidden admin mode: only users with role "admin" (Super Admin).
export default function AdminRoute() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}