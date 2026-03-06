import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KIOSK_STORAGE_KEY } from '../types/kiosk.ts';
import { buildKioskSessionDraft, readPersistedKioskSession } from './kioskSession.ts';
import { createKioskStore } from './kioskStore.ts';

interface MemoryStorage {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
}

function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
    removeItem: (name) => {
      values.delete(name);
    },
  };
}

function waitForHydration(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('activateKiosk persists a valid kiosk session', async () => {
  const storage = createMemoryStorage();
  const store = createKioskStore(() => storage);
  await waitForHydration();

  const session = buildKioskSessionDraft('pickup', 'East Door', true);
  store.getState().activateKiosk(session);

  assert.equal(store.getState().isKioskEnabled, true);
  assert.equal(store.getState().session?.workstationName, 'East Door');
  assert.deepEqual(readPersistedKioskSession(storage.getItem(DEFAULT_KIOSK_STORAGE_KEY)), {
    ...session,
  });
});

test('deactivateKiosk clears the stored kiosk session', async () => {
  const storage = createMemoryStorage();
  const store = createKioskStore(() => storage);
  await waitForHydration();

  store.getState().activateKiosk(buildKioskSessionDraft('lookup-print', 'Front Desk', false));
  store.getState().deactivateKiosk();

  assert.equal(store.getState().session, null);
  assert.equal(store.getState().isKioskEnabled, false);
  assert.equal(readPersistedKioskSession(storage.getItem(DEFAULT_KIOSK_STORAGE_KEY)), null);
});

test('hydration from malformed storage falls back to normal app mode', async () => {
  const storage = createMemoryStorage({
    [DEFAULT_KIOSK_STORAGE_KEY]: JSON.stringify({
      state: {
        session: {
          enabled: true,
          profile: 'walkup',
          workstationName: 'Broken Station',
          enabledAt: '2026-03-06T18:00:00.000Z',
          preferFullscreen: false,
        },
      },
      version: 1,
    }),
  });

  const store = createKioskStore(() => storage);
  await waitForHydration();

  assert.equal(store.getState().hasHydrated, true);
  assert.equal(store.getState().session, null);
  assert.equal(store.getState().isKioskEnabled, false);
});
