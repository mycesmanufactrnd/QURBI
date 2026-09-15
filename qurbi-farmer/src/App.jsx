import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
// Page imports
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import FarmerVerification from "@/pages/FarmerVerification";
import FarmerRegistrationPolicy from "@/pages/FarmerRegistrationPolicy";
import VerificationPending from "@/pages/VerificationPending";
import VerificationRejected from "@/pages/VerificationRejected";
import Home from "@/pages/Home";
import MyLivestock from "@/pages/MyLivestock";
import AddLivestock from "@/pages/AddLivestock";
import LivestockPolicy from "@/pages/LivestockPolicy";
import EditLivestock from "@/pages/EditLivestock";
import LivestockDetail from "@/pages/LivestockDetail";
import Orders from "@/pages/Orders";
import OrderTracking from "@/pages/OrderTracking";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import BulkListings from "@/pages/BulkListings";
import AddBulkListing from "@/pages/AddBulkListing";
import BulkListingDetail from "@/pages/BulkListingDetail";
import AppLayout from "@/components/agri/AppLayout";
import VerifiedAppGate from "@/components/agri/VerifiedAppGate";
import AdminRoute from "@/components/agri/AdminRoute";
import AdminLayout from "@/components/agri/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminFarmers from "@/pages/admin/AdminFarmers";
import AdminFarmerReview from "@/pages/admin/AdminFarmerReview";
import AdminLivestock from "@/pages/admin/AdminLivestock";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminBreeds from "@/pages/admin/AdminBreeds";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminLivestockDetail from "@/pages/admin/AdminLivestockDetail";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated area */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        {/* Verification flow (no gate) */}
        <Route path="/verify" element={<FarmerVerification />} />
        <Route path="/verify/policy" element={<FarmerRegistrationPolicy />} />
        <Route path="/pending" element={<VerificationPending />} />
        <Route path="/rejected" element={<VerificationRejected />} />

        {/* Verified farmer app */}
        <Route element={<VerifiedAppGate />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/livestock" element={<MyLivestock />} />
            <Route path="/livestock/add" element={<AddLivestock />} />
            <Route path="/livestock/add/policy" element={<LivestockPolicy />} />
            <Route path="/livestock/:id" element={<LivestockDetail />} />
            <Route path="/livestock/:id/edit" element={<EditLivestock />} />
            <Route path="/bulk" element={<BulkListings />} />
            <Route path="/bulk/add" element={<AddBulkListing />} />
            <Route path="/bulk/:id" element={<BulkListingDetail />} />
            <Route path="/bulk/:id/edit" element={<AddBulkListing />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:orderId" element={<OrderTracking />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Hidden admin mode */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/farmers" element={<AdminFarmers />} />
            <Route path="/admin/farmers/:id" element={<AdminFarmerReview />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/livestock" element={<AdminLivestock />} />
            <Route path="/admin/livestock/:id" element={<AdminLivestockDetail />} />
            <Route path="/admin/breeds" element={<AdminBreeds />} />
            <Route path="/admin/species" element={<Navigate to="/admin/breeds" replace />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
