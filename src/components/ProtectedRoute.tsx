import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profileLoading } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Decision - Path:', location.pathname, 'Loading:', loading || profileLoading, 'User:', user?.id, 'IsAnonymous:', user?.is_anonymous);

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
    console.log('[ProtectedRoute] Access Denied. Redirecting to /login.');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  console.log('[ProtectedRoute] Access Granted.');
  return <>{children}</>;
};

export default ProtectedRoute;
