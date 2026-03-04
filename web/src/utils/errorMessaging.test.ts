import test from 'node:test';
import assert from 'node:assert/strict';
import { mapToActionableError, toBannerMessage } from './errorMessaging.ts';

test('mapToActionableError maps sale closed messages to actionable guidance', () => {
  const mapped = mapToActionableError('Sale is closed for the day');

  assert.equal(mapped.whatHappened, 'Sales are currently closed.');
  assert.equal(mapped.whatToDoNext, 'Ask an admin to reopen sales or wait until sales reopen.');
  assert.equal(mapped.details, 'Sale is closed for the day');
});

test('mapToActionableError falls back to default messaging for unknown errors', () => {
  const mapped = mapToActionableError('unexpected low-level parser panic');

  assert.equal(mapped.whatHappened, 'Something went wrong while processing your request.');
  assert.equal(mapped.whatToDoNext, 'Try again. If this keeps happening, ask an admin to review the technical details.');
});

test('toBannerMessage includes technical details when available', () => {
  const banner = toBannerMessage({
    whatHappened: 'This item is out of stock.',
    whatToDoNext: 'Set aside the item and ask an admin to adjust inventory or substitute another item.',
    details: 'Inventory check failed for SKU-42',
  });

  assert.match(banner, /^What happened:/);
  assert.match(banner, /What to do next:/);
  assert.match(banner, /Technical details: Inventory check failed for SKU-42/);
});
