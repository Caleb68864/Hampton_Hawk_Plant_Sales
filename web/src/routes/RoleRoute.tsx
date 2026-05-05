import { Outlet } from 'react-router-dom';
import type { AppRole } from '../types/auth.js';
import { useAuthStore } from '../stores/authStore.js';
import { AccessDeniedPage } from '../pages/auth/AccessDeniedPage.js';

interface RoleRouteProps {
  roles: AppRole[];
}

export function RoleRoute({ roles }: RoleRouteProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasAccess = currentUser?.roles.some((r) => roles.includes(r)) ?? false;

  if (!hasAccess) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
}
