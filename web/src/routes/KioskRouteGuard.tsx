import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../components/shared/LoadingSpinner.js';
import { useKioskNavigation, useKioskStorageSync } from '../hooks/useKioskNavigation.js';

export function KioskRouteGuard() {
  const location = useLocation();
  useKioskStorageSync();

  const { hasHydrated, redirectTo } = useKioskNavigation(location.pathname);

  if (!hasHydrated) {
    return <LoadingSpinner message="Loading station..." />;
  }

  if (redirectTo && redirectTo !== location.pathname) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
