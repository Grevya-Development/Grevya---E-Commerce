import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as ToasterSonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/lib/supabaseClient";

// Global Premium UX Components
import MemberBenefitsBar from "@/components/MemberBenefitsBar";
import SpotlightSearch from "@/components/SpotlightSearch";
import QuickViewModal from "@/components/QuickViewModal";
import MobileBottomNav from "@/components/MobileBottomNav";


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
const ShippingPaymentPolicy = lazy(() => import("./pages/ShippingPaymentPolicy"));

const AppContent = () => {
  const location = useLocation();
  return (
    <>
      <MemberBenefitsBar />
      <SpotlightSearch />
      <QuickViewModal />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800"><div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" /></div>}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity, filter' }}
            className="flex flex-col min-h-screen"
          >
            <Routes location={location}>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:category/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/return-refund-policy" element={<ReturnRefundPolicy />} />
              <Route path="/shipping-payment-policy" element={<ShippingPaymentPolicy />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <MobileBottomNav />
    </>
  );
};

const App = () => {
  useEffect(() => {
    const validateSchema = async () => {
      try {
        const { error: orderError } = await supabase
          .from('orders')
          .select('estimated_delivery')
          .limit(1);

        if (orderError && (orderError.message.includes('column') || orderError.message.includes('schema cache'))) {
          console.warn(
            '%c[Grevya Dev Warning] Supabase Orders table schema mismatch detected (missing estimated_delivery). Please run supabase/recovery_schema.sql in your Supabase SQL Editor.',
            'color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 4px; border-radius: 4px; font-weight: bold;'
          );
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .select('preferences')
          .limit(1);

        if (profileError && (profileError.message.includes('column') || profileError.message.includes('schema cache'))) {
          console.warn(
            '%c[Grevya Dev Warning] Supabase Profiles table schema mismatch detected (missing preferences). Please run supabase/recovery_schema.sql in your Supabase SQL Editor.',
            'color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 4px; border-radius: 4px; font-weight: bold;'
          );
        }
      } catch (err) {
        console.error('Schema validation check failed:', err);
      }
    };

    validateSchema();
  }, []);

  return (
  <TooltipProvider>
    <Toaster />
    <ToasterSonner />
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </TooltipProvider>
  );
};

export default App;
