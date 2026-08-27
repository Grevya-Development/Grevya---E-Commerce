import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, ShieldAlert, CheckCircle2, Clock, HelpCircle, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

export default function SellerOnboarding() {
  const { user, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!user) {
        toast({
          title: "Unable to check application status",
          description: "Please sign in again and try once more.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("seller_applications")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Refresh failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        toast({
          title: "No application found",
          description: "We could not find a seller application for this account.",
          variant: "destructive",
        });
        return;
      }

      if (data.status === "approved") {
        await refreshProfile();
        navigate("/seller/dashboard", { replace: true });
        return;
      }

      if (data.status === "rejected") {
        toast({
          title: "Application rejected",
          description: "Your application was not approved. You can submit a new application.",
        });
        navigate("/seller/application", { replace: true });
        return;
      }

      toast({
        title: "Application under review",
        description: "Your application is still being reviewed.",
      });
    } catch (err: unknown) {
      toast({
        title: "Refresh failed",
        description: err instanceof Error ? err.message : "Unable to refresh application status.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EEE4]/20">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full bg-white rounded-[2rem] border border-[#A68D65]/25 shadow-2xl p-8 sm:p-12 text-center relative overflow-hidden">
          
          {/* Animated Background Orbs */}
          <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-[#33381C]/5 rounded-full blur-2xl -z-10" />
          <div className="absolute bottom-[-50px] right-[-50px] w-56 h-56 bg-[#A68D65]/10 rounded-full blur-2xl -z-10" />

          {/* Icon Header */}
          <div className="mx-auto w-20 h-20 bg-[#33381C]/5 rounded-full flex items-center justify-center text-[#33381C] mb-8 relative">
            <Clock className="w-10 h-10 animate-pulse text-[#33381C]" />
            <div className="absolute inset-0 border border-dashed border-[#33381C]/20 rounded-full animate-[spin_12s_linear_infinite]" />
          </div>

          {/* Titles */}
          <h1 className="font-serif text-3xl font-extrabold text-[#1D1E19] mb-3">
            Application Under Review
          </h1>
          <p className="text-neutral-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            Thank you for joining the Grevya Naturals marketplace! Our verification administrators are checking your catalog alignment and seller credentials.
          </p>

          {/* Timeline Process Cards */}
          <div className="space-y-4 mb-10 text-left rounded-2xl bg-[#F7EEE4]/30 p-6 border border-[#A68D65]/15">
            <h3 className="font-bold text-[#33381C] text-xs uppercase tracking-wider mb-4 border-b border-[#A68D65]/10 pb-2">
              Verification Timeline
            </h3>
            
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                ✓
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#1D1E19]">Account Creation</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5">Your email address has been verified and registered.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start border-t border-[#A68D65]/5 pt-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                2
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#1D1E19]">Catalog & Eco Standards Review</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5">We check for compliance with our zero-waste and traceable sourcing mandates.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start border-t border-[#A68D65]/5 pt-3">
              <div className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                3
              </div>
              <div>
                <h4 className="font-bold text-xs text-neutral-400">Final Dashboard Activation</h4>
                <p className="text-[10px] text-neutral-400 mt-0.5">Once approved, you will receive an confirmation email and full store dashboard access.</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-12 rounded-xl bg-[#33381C] hover:bg-[#262A14] text-xs font-bold w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh Status
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-12 rounded-xl border-[#A68D65]/25 hover:bg-neutral-50 text-[#1D1E19] text-xs font-bold w-full flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-600" />
              Logout / Switch Account
            </Button>
          </div>

          <div className="mt-8 flex justify-center items-center gap-2 text-xs text-neutral-400 font-medium">
            <HelpCircle className="w-4 h-4" />
            <span>Need assistance? Contact us at <a href="mailto:partners@grevya.com" className="text-[#33381C] font-bold hover:underline">partners@grevya.com</a></span>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
