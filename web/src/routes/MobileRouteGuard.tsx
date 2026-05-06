import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { hasMobileAccess } from './mobileRouteConfig.js';
import { MobileLayout } from '../layouts/MobileLayout.js';

export function MobileRouteGuard() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasMobileAccess(currentUser)) {
    return <Navigate to="/mobile/access-denied" replace />;
  }

  return <MobileLayout />;
}
