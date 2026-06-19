import SellerSidebar from "@/components/seller/SellerSidebar";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

export default function SellerLayout({ children }: Props) {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 text-green-800">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />
          Verifying seller access...
        </div>
      </div>
    );
  }

  if (!user || user.is_anonymous || profile?.is_active === false || profile?.role !== "seller") {
    return <Navigate to="/seller/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen flex bg-green-50">
      <SellerSidebar />

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
