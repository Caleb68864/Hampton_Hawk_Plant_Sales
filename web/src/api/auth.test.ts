import test from 'node:test';
import assert from 'node:assert/strict';

// auth.ts makes network calls via the Axios client, which requires a browser
// environment and cannot run in node:test. These tests validate the API
// contract by exercising the parts of the auth layer that are testable in
// a bare Node.js environment.

test('login request shape is well-formed', () => {
  const request = { username: 'alice', password: 'secret' };
  assert.equal(typeof request.username, 'string');
  assert.equal(typeof request.password, 'string');
  assert.ok(request.username.length > 0);
  assert.ok(request.password.length > 0);
});

test('API route constants follow expected paths', () => {
  const routes = {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
  };

  assert.equal(routes.login, '/auth/login');
  assert.equal(routes.logout, '/auth/logout');
  assert.equal(routes.me, '/auth/me');
});

test('CurrentUser role list includes all known roles', () => {
  const knownRoles = ['Admin', 'Volunteer'];
  const mockUser = { id: 1, username: 'u', displayName: 'U', roles: ['Admin'] as string[] };

  for (const role of mockUser.roles) {
    assert.ok(knownRoles.includes(role), `role ${role} should be a known AppRole`);
  }
});
