import type { AppRole } from '../types/auth.js';
import type { CurrentUser } from '../types/auth.js';

export interface MobileWorkflow {
  id: string;
  label: string;
  path: string;
  enabled: boolean;
  role: AppRole[];
}

const PICKUP_ROLES: AppRole[] = ['Pickup', 'Admin'];
const LOOKUP_ROLES: AppRole[] = ['LookupPrint', 'Pickup', 'Admin'];

const ALL_WORKFLOWS: MobileWorkflow[] = [
  {
    id: 'pickup',
    label: 'Pickup',
    path: '/mobile/pickup',
    enabled: true,
    role: PICKUP_ROLES,
  },
  {
    id: 'lookup',
    label: 'Lookup',
    path: '/mobile/lookup',
    enabled: true,
    role: LOOKUP_ROLES,
  },
];

export function getMobileWorkflows(user: CurrentUser | null): MobileWorkflow[] {
  if (!user) return [];
  return ALL_WORKFLOWS.filter((w) => w.role.some((r) => user.roles.includes(r)));
}

export function hasMobileAccess(user: CurrentUser | null): boolean {
  return getMobileWorkflows(user).length > 0;
}
