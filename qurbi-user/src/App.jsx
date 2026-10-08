import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider } from "@/lib/AuthContext";
import { CartProvider } from "@/lib/cart-context";
import { UserProfileProvider } from "@/lib/user-profile-context";
import AppLayout from "@/components/AppLayout";
import StandaloneLayout from "@/components/StandaloneLayout";
import Authentication from "@/pages/Authentication";
import SignupDetails from "@/pages/SignupDetails";
import SwitchSession from "@/pages/SwitchSession";
import UserAgreement from "@/pages/UserAgreement";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import LivestockDetail from "@/pages/LivestockDetail";
import BulkBuy from "@/pages/BulkBuy";
import BulkListingDetail from "@/pages/BulkListingDetail";
import Cart from "@/pages/Cart";
import Payment from "@/pages/Payment";
import Receipt from "@/pages/Receipt";
import ChipPaymentReturn from "@/pages/ChipPaymentReturn";
import TransactionHistory from "@/pages/TransactionHistory";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import AddressBook from "@/pages/AddressBook";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsConditions from "@/pages/TermsConditions";
import CustomerSupport from "@/pages/CustomerSupport";
import AdminBreeds from "@/pages/AdminBreeds";
import HeaderTransitionProvider from "@/components/HeaderTransitionProvider";
import { NotificationProvider } from "@/lib/notification-context";
import Notifications from "@/pages/Notifications";
import AdminTest from "@/pages/AdminTest";
import { AuthPromptProvider } from "@/lib/auth-prompt-context";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import RouteSeo from "@/components/RouteSeo";

function LegacyAuthRedirect({ mode }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("mode", mode);
  return <Navigate to={`/auth?${params.toString()}`} replace />;
}

// `Router`/`routerProps` let the build-time prerenderer supply a StaticRouter;
// in the browser it is always the normal BrowserRouter.
function App({ Router = BrowserRouter, routerProps = {} }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <UserProfileProvider>
          <CartProvider>
            <Router {...routerProps}>
              <RouteSeo />
              <AuthPromptProvider>
                <NotificationProvider>
                  <HeaderTransitionProvider>
                  <AppErrorBoundary>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/browse" element={<Browse />} />
                      <Route
                        path="/livestock/:id"
                        element={<LivestockDetail />}
                      />
                      <Route path="/bulk-buy" element={<BulkBuy />} />
                      <Route
                        path="/bulk-buy/:id"
                        element={<BulkListingDetail />}
                      />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/payment" element={<Payment />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route
                        path="/orders/:orderId"
                        element={<OrderDetail />}
                      />
                      <Route path="/transaction-history" element={<TransactionHistory />} />
                      <Route path="/history" element={<Navigate to="/transaction-history" replace />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />
                    </Route>
                    <Route element={<StandaloneLayout />}>
                      <Route path="/auth" element={<Authentication />} />
                      <Route path="/login" element={<LegacyAuthRedirect mode="login" />} />
                      <Route path="/register" element={<LegacyAuthRedirect mode="register" />} />
                      <Route path="/switch-session" element={<SwitchSession />} />
                      <Route path="/signup-details" element={<SignupDetails />} />
                      <Route path="/user-agreement" element={<UserAgreement />} />
                      <Route path="/address-book" element={<AddressBook />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms-conditions" element={<TermsConditions />} />
                      <Route path="/support" element={<CustomerSupport />} />
                      <Route path="/admin/breeds" element={<AdminBreeds />} />
                      <Route path="/admin/test" element={<AdminTest />} />
                      <Route path="/receipt" element={<Receipt />} />
                      <Route path="/payment/chip/:result" element={<ChipPaymentReturn />} />
                      <Route path="*" element={<PageNotFound />} />
                    </Route>
                  </Routes>
                  </AppErrorBoundary>
                  </HeaderTransitionProvider>
                </NotificationProvider>
              </AuthPromptProvider>
            </Router>
          </CartProvider>
        </UserProfileProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
