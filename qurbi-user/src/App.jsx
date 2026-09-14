import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider } from "@/lib/AuthContext";
import { CartProvider } from "@/lib/cart-context";
import { UserProfileProvider } from "@/lib/user-profile-context";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import SignupDetails from "@/pages/SignupDetails";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import LivestockDetail from "@/pages/LivestockDetail";
import BulkBuy from "@/pages/BulkBuy";
import BulkListingDetail from "@/pages/BulkListingDetail";
import Cart from "@/pages/Cart";
import Payment from "@/pages/Payment";
import Receipt from "@/pages/Receipt";
import History from "@/pages/History";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import AddressBook from "@/pages/AddressBook";
import AdminBreeds from "@/pages/AdminBreeds";
import HeaderTransitionProvider from "@/components/HeaderTransitionProvider";
import { NotificationProvider } from "@/lib/notification-context";
import Notifications from "@/pages/Notifications";
import AdminTest from "@/pages/AdminTest";

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <UserProfileProvider>
          <CartProvider>
            <Router>
              <NotificationProvider>
                <HeaderTransitionProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/signup-details" element={<SignupDetails />} />
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
                      <Route path="/history" element={<History />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />
                    </Route>
                    <Route path="/address-book" element={<AddressBook />} />
                    <Route path="/admin/breeds" element={<AdminBreeds />} />
                    <Route path="/admin/test" element={<AdminTest />} />
                    <Route path="/receipt" element={<Receipt />} />
                    <Route path="*" element={<PageNotFound />} />
                  </Routes>
                </HeaderTransitionProvider>
              </NotificationProvider>
            </Router>
          </CartProvider>
        </UserProfileProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
