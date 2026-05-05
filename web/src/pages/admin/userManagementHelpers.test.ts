import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUserForm,
  hasFormErrors,
  stationUserPresets,
  ALL_ROLES,
  type UserFormValues,
} from './userManagementHelpers.js';

function validForm(): UserFormValues {
  return {
    username: 'POS2',
    displayName: 'POS Station 2',
    password: 'saleday1',
    isActive: true,
    roles: ['Volunteer'],
  };
}

test('validateUserForm returns no errors for a valid new-user form', () => {
  const errors = validateUserForm(validForm(), true);
  assert.deepEqual(errors, {});
});

test('validateUserForm requires username', () => {
  const errors = validateUserForm({ ...validForm(), username: '' }, true);
  assert.ok(typeof errors.username === 'string' && errors.username.length > 0);
});

test('validateUserForm rejects usernames with special characters', () => {
  const errors = validateUserForm({ ...validForm(), username: 'bad name!' }, true);
  assert.ok(typeof errors.username === 'string');
});

test('validateUserForm accepts alphanumeric usernames with underscores and dashes', () => {
  const errors = validateUserForm({ ...validForm(), username: 'pos_2-station' }, true);
  assert.equal(errors.username, undefined);
});

test('validateUserForm requires displayName', () => {
  const errors = validateUserForm({ ...validForm(), displayName: '   ' }, true);
  assert.ok(typeof errors.displayName === 'string');
});

test('validateUserForm requires password when requirePassword=true', () => {
  const errors = validateUserForm({ ...validForm(), password: '' }, true);
  assert.ok(typeof errors.password === 'string');
});

test('validateUserForm does not require password when requirePassword=false (edit mode)', () => {
  const errors = validateUserForm({ ...validForm(), password: '' }, false);
  assert.equal(errors.password, undefined);
});

test('validateUserForm rejects passwords shorter than 6 characters', () => {
  const errors = validateUserForm({ ...validForm(), password: 'abc' }, true);
  assert.ok(typeof errors.password === 'string');
});

test('validateUserForm requires at least one role', () => {
  const errors = validateUserForm({ ...validForm(), roles: [] }, true);
  assert.ok(typeof errors.roles === 'string');
});

test('hasFormErrors returns false when no errors', () => {
  assert.equal(hasFormErrors({}), false);
});

test('hasFormErrors returns true when any field has an error', () => {
  assert.equal(hasFormErrors({ username: 'Required.' }), true);
});

test('ALL_ROLES contains Admin and Volunteer', () => {
  assert.ok(ALL_ROLES.includes('Admin'));
  assert.ok(ALL_ROLES.includes('Volunteer'));
});

test('stationUserPresets returns at least 4 entries', () => {
  const presets = stationUserPresets();
  assert.ok(presets.length >= 4);
});

test('stationUserPresets entries have label, username, and displayName', () => {
  const presets = stationUserPresets();
  for (const p of presets) {
    assert.ok(typeof p.label === 'string' && p.label.length > 0);
    assert.ok(typeof p.username === 'string' && p.username.length > 0);
    assert.ok(typeof p.displayName === 'string' && p.displayName.length > 0);
  }
});

test('stationUserPresets includes POS2 and Pickup1', () => {
  const usernames = stationUserPresets().map((p) => p.username);
  assert.ok(usernames.includes('POS2'));
  assert.ok(usernames.includes('Pickup1'));
});
