import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKioskSessionDraft, getDefaultWorkstationName, isKioskProfile, normalizeStoredKioskSession, readPersistedKioskSession } from './kioskSession.ts';

test('accepts only supported kiosk profiles', () => {
  assert.equal(isKioskProfile('pickup'), true);
  assert.equal(isKioskProfile('lookup-print'), true);
  assert.equal(isKioskProfile('walkup'), false);
});

test('normalizes malformed stored data to disabled mode', () => {
  assert.equal(normalizeStoredKioskSession(null), null);
  assert.equal(normalizeStoredKioskSession({ enabled: true, profile: 'walkup' }), null);
  assert.equal(normalizeStoredKioskSession({ enabled: true, profile: 'pickup', workstationName: '', enabledAt: 'bad-date' }), null);
});

test('preserves valid kiosk session fields and ignores unknown keys', () => {
  const normalized = normalizeStoredKioskSession({
    enabled: true,
    profile: 'lookup-print',
    workstationName: 'Front Table',
    enabledAt: '2026-03-06T18:00:00.000Z',
    preferFullscreen: true,
    extra: 'ignored',
  });

  assert.deepEqual(normalized, {
    enabled: true,
    profile: 'lookup-print',
    workstationName: 'Front Table',
    enabledAt: '2026-03-06T18:00:00.000Z',
    preferFullscreen: true,
  });
});

test('buildKioskSessionDraft applies a profile default name when blank', () => {
  const session = buildKioskSessionDraft('pickup', '   ', true);

  assert.equal(session.workstationName, getDefaultWorkstationName('pickup'));
  assert.equal(session.preferFullscreen, true);
  assert.equal(session.enabled, true);
});

test('readPersistedKioskSession reads zustand persisted state', () => {
  const raw = JSON.stringify({
    state: {
      session: {
        enabled: true,
        profile: 'pickup',
        workstationName: 'South Door',
        enabledAt: '2026-03-06T18:00:00.000Z',
        preferFullscreen: false,
      },
    },
    version: 1,
  });

  assert.deepEqual(readPersistedKioskSession(raw), {
    enabled: true,
    profile: 'pickup',
    workstationName: 'South Door',
    enabledAt: '2026-03-06T18:00:00.000Z',
    preferFullscreen: false,
  });
});
