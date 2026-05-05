import type { AppRole } from '../../types/auth.js';

export const ALL_ROLES: AppRole[] = ['Admin', 'Volunteer'];

export interface UserFormValues {
  username: string;
  displayName: string;
  password: string;
  isActive: boolean;
  roles: AppRole[];
}

export interface UserFormErrors {
  username?: string;
  displayName?: string;
  password?: string;
  roles?: string;
}

export function validateUserForm(values: UserFormValues, requirePassword: boolean): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!values.username.trim()) {
    errors.username = 'Username is required.';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(values.username.trim())) {
    errors.username = 'Username may only contain letters, numbers, underscores, and dashes.';
  }

  if (!values.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  }

  if (requirePassword && !values.password.trim()) {
    errors.password = 'Password is required.';
  } else if (values.password && values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (values.roles.length === 0) {
    errors.roles = 'At least one role is required.';
  }

  return errors;
}

export function hasFormErrors(errors: UserFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function stationUserPresets(): { label: string; username: string; displayName: string }[] {
  return [
    { label: 'POS 2', username: 'POS2', displayName: 'POS 2' },
    { label: 'POS 3', username: 'POS3', displayName: 'POS 3' },
    { label: 'Pickup 1', username: 'Pickup1', displayName: 'Pickup 1' },
    { label: 'Pickup 2', username: 'Pickup2', displayName: 'Pickup 2' },
    { label: 'Mobile 1', username: 'Mobile1', displayName: 'Mobile 1' },
    { label: 'Mobile 2', username: 'Mobile2', displayName: 'Mobile 2' },
  ];
}
