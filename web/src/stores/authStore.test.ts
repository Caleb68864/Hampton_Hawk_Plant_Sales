import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdminAuthOptions, useAuthStore } from './authStore.ts';
import type { CurrentUser } from '../types/auth.ts';

function resetAuthStore() {
  useAuthStore.setState({
    showPinModal: false,
    modalOptions: normalizeAdminAuthOptions(),
    pinResolve: null,
    currentUser: null,
    sessionStatus: 'loading',
  });
}

// ── Admin PIN modal ───────────────────────────────────────────────────────────

test('normalizeAdminAuthOptions keeps reason required by default', () => {
  const options = normalizeAdminAuthOptions();

  assert.equal(options.requireReason, true);
  assert.equal(options.confirmLabel, 'Authorize');
});

test('openPinModal supports verify-only flows without a reason', async () => {
  resetAuthStore();

  const pending = useAuthStore.getState().openPinModal({
    requireReason: false,
    title: 'Unlock Station',
    confirmLabel: 'Unlock',
  });

  const state = useAuthStore.getState();
  assert.equal(state.showPinModal, true);
  assert.equal(state.modalOptions.requireReason, false);
  assert.equal(state.modalOptions.title, 'Unlock Station');

  useAuthStore.getState().submitPin('2468', '');

  assert.deepEqual(await pending, {
    pin: '2468',
    reason: '',
  });
});

// ── User session ──────────────────────────────────────────────────────────────

test('initial session state is loading with no user', () => {
  resetAuthStore();
  const state = useAuthStore.getState();
  assert.equal(state.currentUser, null);
  assert.equal(state.sessionStatus, 'loading');
});

test('hasRole returns false when no user is set', () => {
  resetAuthStore();
  const hasRole = useAuthStore.getState().hasRole;
  assert.equal(hasRole('Admin'), false);
  assert.equal(hasRole('Volunteer'), false);
});

test('hasRole returns true when user has the queried role', () => {
  resetAuthStore();

  const mockUser: CurrentUser = {
    id: 1,
    username: 'admin',
    displayName: 'Admin User',
    roles: ['Admin'],
  };

  useAuthStore.setState({ currentUser: mockUser, sessionStatus: 'authenticated' });

  const { hasRole } = useAuthStore.getState();
  assert.equal(hasRole('Admin'), true);
  assert.equal(hasRole('Volunteer'), false);
});

test('hasRole returns false after user is cleared', () => {
  resetAuthStore();

  useAuthStore.setState({
    currentUser: { id: 1, username: 'u', displayName: 'U', roles: ['Admin'] },
    sessionStatus: 'authenticated',
  });

  useAuthStore.setState({ currentUser: null, sessionStatus: 'unauthenticated' });

  assert.equal(useAuthStore.getState().hasRole('Admin'), false);
});

test('restoreSession sets unauthenticated when API call fails', async () => {
  resetAuthStore();

  // restoreSession will call getCurrentUser which will fail (no server in tests)
  await useAuthStore.getState().restoreSession();

  const state = useAuthStore.getState();
  assert.equal(state.sessionStatus, 'unauthenticated');
  assert.equal(state.currentUser, null);
});
