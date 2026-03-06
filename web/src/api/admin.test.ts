import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminHeaders } from './adminHeaders.ts';

test('buildAdminHeaders includes the admin pin', () => {
  assert.deepEqual(buildAdminHeaders('1234'), {
    'X-Admin-Pin': '1234',
  });
});

test('buildAdminHeaders trims and includes optional reason', () => {
  assert.deepEqual(buildAdminHeaders(' 4321 ', '  unlock station  '), {
    'X-Admin-Pin': '4321',
    'X-Admin-Reason': 'unlock station',
  });
});
