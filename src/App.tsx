import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const Orders = lazy(() => import("./pages/Orders"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Terms = lazy(() => import("./pages/Terms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ReturnRefundPolicy = lazy(() => import("./pages/ReturnRefundPolicy"));
const ShippingPaymentPolicy = lazy(() => import("./pages/ShippingPaymentPolicy"),);

//Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminProductRequests = lazy(() => import("./pages/admin/AdminProductRequests"),);
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"),);

// Seller Pages
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const AddProduct = lazy(() => import("./pages/seller/AddProduct"));
const MyProducts = lazy(() => import("./pages/seller/MyProducts"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const PendingProducts = lazy(() => import("./pages/seller/PendingProducts"));

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:category/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/login" element={<Navigate to="/account/login" replace />}/>
          <Route path="/auth" element={<Navigate to="/account/login" replace />}/>
          <Route path="/signup" element={<Navigate to="/account/register" replace />}/>
          <Route path="/account/login" element={<Login role="buyer" />} />
          <Route path="/account/register" element={<Signup role="buyer" />} />
          <Route path="/seller/login" element={<Login role="seller" />} />
          <Route path="/seller/register" element={<Signup role="seller" />} />
          <Route path="/admin/login" element={<Login role="admin" />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute
                allowedRoles={["buyer"]}
                loginPath="/account/login"
              >
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute
                allowedRoles={["buyer"]}
                loginPath="/account/login"
              >
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute
                allowedRoles={["buyer"]}
                loginPath="/account/login"
              >
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route
            path="/return-refund-policy"
            element={<ReturnRefundPolicy />}
          />
          <Route
            path="/shipping-payment-policy"
            element={<ShippingPaymentPolicy />}
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminProducts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminOrders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminNotifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/product-requests"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminProductRequests />
              </ProtectedRoute>
            }
          />

          {/* Seller Routes */}
          <Route
            path="/seller/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={["seller"]}
                loginPath="/seller/login"
              >
                <SellerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/seller/add-product"
            element={
              <ProtectedRoute
                allowedRoles={["seller"]}
                loginPath="/seller/login"
              >
                <AddProduct />
              </ProtectedRoute>
            }
          />

          <Route
            path="/seller/products"
            element={
              <ProtectedRoute
                allowedRoles={["seller"]}
                loginPath="/seller/login"
              >
                <MyProducts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/seller/orders"
            element={
              <ProtectedRoute
                allowedRoles={["seller"]}
                loginPath="/seller/login"
              >
                <SellerOrders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/seller/pending-products"
            element={
              <ProtectedRoute
                allowedRoles={["seller"]}
                loginPath="/seller/login"
              >
                <PendingProducts />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
