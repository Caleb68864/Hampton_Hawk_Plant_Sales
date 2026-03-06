import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdminAuthOptions, useAuthStore } from './authStore.ts';

function resetAuthStore() {
  useAuthStore.setState({
    showPinModal: false,
    modalOptions: normalizeAdminAuthOptions(),
    pinResolve: null,
  });
}

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
