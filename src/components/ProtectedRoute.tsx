import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

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

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || "customer";
    if (!allowedRoles.includes(userRole)) {
      const redirectTo = loginPath || "/login";
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
