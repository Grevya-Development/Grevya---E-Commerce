import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import ProtectedRoute from "./routes/ProtectedRoute";
import AuthInitializer from "./components/AuthInitializer";
import Wishlist from "@/pages/Wishlist";

// Public Pages
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Contact = lazy(() => import("./pages/Contact"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Auth Pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

//Admin Dashboard Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminProductRequests = lazy(() => import("./pages/admin/AdminProductRequests"),);
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"),);
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

// Seller Pages
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const AddProduct = lazy(() => import("./pages/seller/AddProduct"));
const MyProducts = lazy(() => import("./pages/seller/MyProducts"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const PendingProducts = lazy(() => import("./pages/seller/PendingProducts"));

const App = () => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthInitializer />

      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">
              Loading...
            </div>
          }
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/products" element={<Products />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route
              path="/products/:category/:slug"
              element={<ProductDetail />}
            />
            <Route path="/cart" element={<Cart />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />

            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Buyer Routes */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute allowedRoles={["buyer", "seller", "admin"]}>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={["buyer", "seller", "admin"]}>
                  <Profile />
                </ProtectedRoute>
              }
            />

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
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSettings />
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
                <ProtectedRoute allowedRoles={["seller", "admin"]}>
                  <SellerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/seller/add-product"
              element={
                <ProtectedRoute allowedRoles={["seller", "admin"]}>
                  <AddProduct />
                </ProtectedRoute>
              }
            />

            <Route
              path="/seller/products"
              element={
                <ProtectedRoute allowedRoles={["seller", "admin"]}>
                  <MyProducts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/seller/orders"
              element={
                <ProtectedRoute allowedRoles={["seller", "admin"]}>
                  <SellerOrders />
                </ProtectedRoute>
              }
            />

            <Route
              path="/seller/pending-products"
              element={
                <ProtectedRoute allowedRoles={["seller", "admin"]}>
                  <PendingProducts />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
