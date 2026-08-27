import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  loginPath?: string;
}

const ProtectedRoute = ({
  children,
  allowedRoles,
  loginPath,
}: ProtectedRouteProps) => {
  const { user, loading, profileLoading, profile } = useAuth();
  const location = useLocation();
  const [sellerApplicationState, setSellerApplicationState] = useState<
    "checking" | "approved" | "pending" | "rejected" | "unavailable"
  >("checking");
  const isSellerRoute = allowedRoles?.includes("seller") ?? false;

  useEffect(() => {
    if (loading || profileLoading || !user?.id || !profile) {
      return;
    }

    let cancelled = false;
    const checkApplication = async (): Promise<"approved" | "pending" | "rejected" | "unavailable"> => {
      console.log("Profile role:", profile.role);
      console.log("Checking seller application...");

      try {
        if (profile.role === "seller") {
          return "approved";
        }

        const { data: sellerRole, error: sellerRoleError } = await supabase
          .from("roles")
          .select("id")
          .eq("name", "seller")
          .single();

        if (sellerRoleError) throw sellerRoleError;

        const { data: userRole, error: userRoleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("role_id", sellerRole.id)
          .maybeSingle();

        if (userRoleError) throw userRoleError;
        if (userRole) {
          return "approved";
        }

        const { data, error } = await supabase
          .from("seller_applications")
          .select("status")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        return data?.status === "approved"
          ? "approved"
          : data?.status === "pending" || data?.status === "under_review"
            ? "pending"
            : "rejected";
      } catch (error) {
        console.error("Could not check seller application status:", error);
        return "unavailable";
      } finally {
        console.log("Finished checking seller application.");
      }
    };

    setSellerApplicationState("checking");
    void checkApplication().then((nextState) => {
      if (!cancelled) setSellerApplicationState(nextState);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.role, profileLoading, user?.id]);

  useEffect(() => {
    console.log("Seller application state:", sellerApplicationState);
  }, [sellerApplicationState]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
          Restoring your secure session...
        </div>
      </div>
    );
  }

  if (!user || user.is_anonymous) {
    const redirectTo = loginPath || "/login";
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (!profile || profile.is_active === false) {
    const redirectTo = loginPath || "/login";
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = sellerApplicationState === "approved" && isSellerRoute
      ? "seller"
      : profile?.role || "customer";
    if (isSellerRoute && sellerApplicationState === "checking") {
      return <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">Checking seller application...</div>;
    }
    if (!allowedRoles.includes(userRole)) {
      const redirectTo = loginPath || "/login";
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
  }

  const isPendingSeller = profile?.role === "seller" && profile?.status === "pending";
  if (isPendingSeller && sellerApplicationState !== "approved" && sellerApplicationState !== "unavailable") {
    const destination = sellerApplicationState === "pending"
      ? "/seller/onboarding"
      : "/seller/application";

    if (location.pathname !== destination) {
      return <Navigate to={destination} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
