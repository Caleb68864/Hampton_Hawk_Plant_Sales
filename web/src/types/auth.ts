export type AppRole = 'Admin' | 'Volunteer' | 'Pickup' | 'LookupPrint' | 'POS';

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  roles: AppRole[];
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';
