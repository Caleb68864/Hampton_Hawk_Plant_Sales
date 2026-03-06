import test from 'node:test';
import assert from 'node:assert/strict';
import { getKioskRedirectPath } from './useKioskNavigation.ts';
import type { KioskSession } from '../types/kiosk.ts';

const pickupSession: KioskSession = {
  enabled: true,
  profile: 'pickup',
  workstationName: 'Pickup Station',
  enabledAt: '2026-03-06T18:00:00.000Z',
  preferFullscreen: false,
};

test('returns no redirect when kiosk mode is inactive', () => {
  assert.equal(getKioskRedirectPath(null, '/orders'), null);
});

test('redirects blocked kiosk paths back to the landing route', () => {
  assert.equal(getKioskRedirectPath(pickupSession, '/orders'), '/pickup');
});

test('allows permitted kiosk paths and print routes to stay in place', () => {
  assert.equal(getKioskRedirectPath(pickupSession, '/pickup/order-1'), null);
  assert.equal(getKioskRedirectPath(pickupSession, '/print/order/order-1'), null);
});
