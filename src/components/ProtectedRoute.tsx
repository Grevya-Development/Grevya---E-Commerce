import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type UserRole = 'admin' | 'seller' | 'buyer';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  loginPath?: string;
}

const roleLoginPaths: Record<UserRole, string> = {
  admin: '/admin/login',
  seller: '/seller/login',
  buyer: '/account/login',
};

const normalizeRole = (role?: string | null): UserRole => {
  if (role === 'admin' || role === 'seller' || role === 'buyer') {
    return role;
  }

  return 'buyer';
};

const getLoginPath = (allowedRoles?: UserRole[], loginPath?: string) => {
  if (loginPath) return loginPath;
  if (allowedRoles?.length === 1) return roleLoginPaths[allowedRoles[0]];
  return '/account/login';
};

const ProtectedRoute = ({ children, allowedRoles, loginPath }: ProtectedRouteProps) => {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();
  const currentRole = normalizeRole(profile?.role);
  const redirectToLogin = getLoginPath(allowedRoles, loginPath);

  console.log(
    '[ProtectedRoute] Decision - Path:',
    location.pathname,
    'Loading:',
    loading || profileLoading,
    'User:',
    user?.id,
    'Role:',
    currentRole,
    'IsAnonymous:',
    user?.is_anonymous,
  );

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
    console.log('[ProtectedRoute] Access Denied. Redirecting to login.');
    return <Navigate to={redirectToLogin} replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !profile) {
    console.log('[ProtectedRoute] Access Denied. Profile is required for role-protected route.');
    return <Navigate to={redirectToLogin} replace state={{ from: location }} />;
  }

  if (profile?.is_active === false) {
    console.log('[ProtectedRoute] Access Denied. User account is blocked.');
    return <Navigate to={redirectToLogin} replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentRole)) {
    console.log('[ProtectedRoute] Access Denied. Role is not allowed.');
    return <Navigate to={redirectToLogin} replace state={{ from: location }} />;
  }

  console.log('[ProtectedRoute] Access Granted.');
  return <>{children}</>;
};

export default ProtectedRoute;
