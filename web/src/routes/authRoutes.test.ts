import test from 'node:test';
import assert from 'node:assert/strict';

// Route guard components are React components and cannot be exercised in a
// bare node:test environment without a DOM / jsdom. These tests verify the
// module exports exist and have the expected shape so that a misconfigured
// import is caught early at test time.

test('ProtectedRoute is exported as a function', async () => {
  const mod = await import('./ProtectedRoute.tsx');
  assert.equal(typeof mod.ProtectedRoute, 'function', 'ProtectedRoute must be a named export');
});

test('RoleRoute is exported as a function', async () => {
  const mod = await import('./RoleRoute.tsx');
  assert.equal(typeof mod.RoleRoute, 'function', 'RoleRoute must be a named export');
});
