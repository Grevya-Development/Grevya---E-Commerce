import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Props {
  children: ReactNode;
}

const roleRedirects: Record<string, string> = {
  seller: "/admin/login",
  customer: "/admin/login",
};

export default function AdminLayout({ children }: Props) {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();
  const role = profile?.role || "customer";

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-green-800">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
          Verifying admin access...
        </div>
      </div>
    );
  }

  if (!user || user.is_anonymous) {
    return <Navigate to="/account/login" replace state={{ from: location }} />;
  }

  if (profile?.is_active === false) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (role !== "admin") {
    return <Navigate to={roleRedirects[role] || "/account"} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-6 md:p-8 bg-background">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
