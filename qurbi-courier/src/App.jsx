import React from "react";
import { BrowserRouter as Router, Link, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CourierGate, { StatusScreen } from "@/components/CourierGate";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Verify from "@/pages/Verify";
import { Pending, Rejected, Suspended } from "@/pages/StatusScreens";
import Home from "@/pages/Home";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Earnings from "@/pages/Earnings";
import Notifications from "@/pages/Notifications";
import Profile from "@/pages/Profile";

function NotFound() {
  const { t } = useTranslation("common");
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-extrabold">{t("notFound.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("notFound.body")}</p>
      <Button asChild className="mt-6 h-12"><Link to="/">{t("notFound.home")}</Link></Button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
            {/* Before approval: each screen only for its own state. */}
            <Route path="/verify" element={<StatusScreen allow={["unverified", "rejected"]}><Verify /></StatusScreen>} />
            <Route path="/pending" element={<StatusScreen allow={["pending"]}><Pending /></StatusScreen>} />
            <Route path="/rejected" element={<StatusScreen allow={["rejected"]}><Rejected /></StatusScreen>} />
            <Route path="/suspended" element={<StatusScreen allow={["suspended"]}><Suspended /></StatusScreen>} />

            {/* After approval. */}
            <Route element={<CourierGate />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:orderId" element={<JobDetail />} />
                <Route path="/earnings" element={<Earnings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  );
}
