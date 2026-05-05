import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../components/shared/LoadingSpinner.js';
import { useAuthStore } from '../stores/authStore.js';

export function ProtectedRoute() {
  const sessionStatus = useAuthStore((s) => s.sessionStatus);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const location = useLocation();

  useEffect(() => {
    if (sessionStatus === 'loading') {
      void restoreSession();
    }
  }, [sessionStatus, restoreSession]);

  if (sessionStatus === 'loading') {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (sessionStatus === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
