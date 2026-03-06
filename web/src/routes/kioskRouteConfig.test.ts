import test from 'node:test';
import assert from 'node:assert/strict';
import { getKioskLandingRoute, getKioskStationLabel, isKioskPathAllowed, isKioskPrintRoute } from './kioskRouteConfig.ts';

test('resolves the landing route and label for each kiosk profile', () => {
  assert.equal(getKioskLandingRoute('pickup'), '/pickup');
  assert.equal(getKioskLandingRoute('lookup-print'), '/lookup-print');
  assert.equal(getKioskStationLabel('pickup'), 'Pickup Station');
  assert.equal(getKioskStationLabel('lookup-print'), 'Lookup & Print Station');
});

test('allows only pickup routes and required print routes for pickup kiosks', () => {
  assert.equal(isKioskPathAllowed('pickup', '/pickup'), true);
  assert.equal(isKioskPathAllowed('pickup', '/pickup/order-1'), true);
  assert.equal(isKioskPathAllowed('pickup', '/print/order/order-1'), true);
  assert.equal(isKioskPathAllowed('pickup', '/orders'), false);
  assert.equal(isKioskPrintRoute('pickup', '/print/order/order-1'), true);
});

test('allows only lookup-print routes and expected print routes for lookup kiosks', () => {
  assert.equal(isKioskPathAllowed('lookup-print', '/lookup-print'), true);
  assert.equal(isKioskPathAllowed('lookup-print', '/print/order/order-1'), true);
  assert.equal(isKioskPathAllowed('lookup-print', '/print/seller/seller-1'), true);
  assert.equal(isKioskPathAllowed('lookup-print', '/pickup'), false);
  assert.equal(isKioskPrintRoute('lookup-print', '/print/seller/seller-1'), true);
});
