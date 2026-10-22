import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { getAuthorizedUserRoles } from "@/lib/authorizedRoles";

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
  const [roleCheckStatus, setRoleCheckStatus] = useState<
    "checking" | "ready" | "error"
  >("checking");
  const [roleCheckKey, setRoleCheckKey] = useState<string | null>(null);
  const [authorizedRoles, setAuthorizedRoles] = useState<string[]>([]);
  const [roleCheckAttempt, setRoleCheckAttempt] = useState(0);
  const isSellerRoute = allowedRoles?.includes("seller") ?? false;
  const currentRoleCheckKey =
    user?.id && profile
      ? `${user.id}:${profile.role || ""}:${profile.role_id || ""}`
      : null;

  useEffect(() => {
    if (loading || profileLoading || !user?.id || !profile) return;

    let cancelled = false;
    setRoleCheckStatus("checking");
    setRoleCheckKey(currentRoleCheckKey);
    void getAuthorizedUserRoles(user.id, profile)
      .then((roles) => {
        if (cancelled) return;
        setAuthorizedRoles(roles);
        setRoleCheckStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Could not verify authorized account roles:", error);
        if (cancelled) return;
        setAuthorizedRoles([]);
        setRoleCheckStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentRoleCheckKey,
    loading,
    profile,
    profileLoading,
    roleCheckAttempt,
    user?.id,
  ]);

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
  }, [loading, profile, profileLoading, user?.id]);

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

  if (roleCheckStatus === "checking" || roleCheckKey !== currentRoleCheckKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">
        Verifying your account access...
      </div>
    );
  }

  if (roleCheckStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream/30 p-6">
        <div className="max-w-md rounded-2xl border border-neutral-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">
            Account access could not be verified
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            We couldn&apos;t confirm your authorized portal. Please retry or
            return to sign in.
          </p>
          <button
            type="button"
            onClick={() => {
              setRoleCheckStatus("checking");
              setRoleCheckAttempt((attempt) => attempt + 1);
            }}
            className="mt-5 rounded-xl bg-[#33381C] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry verification
          </button>
          <Link
            to={loginPath || "/login"}
            state={{ from: location }}
            className="mt-4 block text-sm font-semibold text-[#33381C] underline"
          >
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (isSellerRoute && sellerApplicationState === "checking") {
      return <div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800">Checking seller application...</div>;
    }
    if (!allowedRoles.some((role) => authorizedRoles.includes(role))) {
      const redirectTo = loginPath || "/login";
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
  }

  const isPendingSeller =
    authorizedRoles.includes("seller") && profile.status === "pending";
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
