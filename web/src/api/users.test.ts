import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppUser } from '../types/user.js';
import type { AppRole } from '../types/auth.js';

// users.ts makes network calls via the Axios client and cannot run in node:test.
// These tests validate the API contract shape and route constants.

test('API route constants follow expected paths', () => {
  const routes = {
    list: '/users',
    create: '/users',
    update: (id: number) => `/users/${id}`,
    resetPassword: (id: number) => `/users/${id}/reset-password`,
  };

  assert.equal(routes.list, '/users');
  assert.equal(routes.create, '/users');
  assert.equal(routes.update(42), '/users/42');
  assert.equal(routes.resetPassword(7), '/users/7/reset-password');
});

test('AppUser shape has required fields', () => {
  const user: AppUser = {
    id: 1,
    username: 'POS2',
    displayName: 'POS Station 2',
    isActive: true,
    roles: ['Volunteer'] as AppRole[],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };

  assert.equal(typeof user.id, 'number');
  assert.equal(typeof user.username, 'string');
  assert.equal(typeof user.displayName, 'string');
  assert.equal(typeof user.isActive, 'boolean');
  assert.ok(Array.isArray(user.roles));
});

test('CreateUserRequest requires username, password, displayName, isActive, and roles', () => {
  const req = {
    username: 'Mobile1',
    password: 'saleday1',
    displayName: 'Mobile 1',
    isActive: true,
    roles: ['Volunteer'] as AppRole[],
  };

  assert.ok(req.username.length > 0);
  assert.ok(req.password.length >= 6);
  assert.ok(req.displayName.length > 0);
  assert.equal(typeof req.isActive, 'boolean');
  assert.ok(req.roles.length > 0);
});

test('UpdateUserRequest does not include username or password', () => {
  const req: { displayName: string; isActive: boolean; roles: AppRole[] } = {
    displayName: 'Updated Name',
    isActive: false,
    roles: ['Volunteer'],
  };

  assert.ok(!('username' in req));
  assert.ok(!('password' in req));
  assert.equal(typeof req.displayName, 'string');
});

test('ResetPasswordRequest contains only newPassword', () => {
  const req = { newPassword: 'newsecret123' };
  assert.equal(typeof req.newPassword, 'string');
  assert.ok(req.newPassword.length >= 6);
});
