import { describe, expect, it } from 'vitest';

/**
 * The suite's own environment, under test.
 *
 * Seven tests failed on this machine with `Cannot read properties of undefined
 * (reading 'getItem')` because Node 26 removes `globalThis.localStorage` and
 * vitest's jsdom environment does not put jsdom's back (see vitest.setup.ts).
 * Every one of those failures pointed at application code that was fine, which
 * is the expensive part: the suite blamed the app for the runtime.
 *
 * These assertions fail *here* instead, in a file whose name says the
 * environment is the subject.
 */
describe('test environment', () => {
  it('exposes a working localStorage on the global', () => {
    expect(typeof globalThis.localStorage).toBe('object');
    globalThis.localStorage.setItem('hh-env-probe', 'value');
    expect(globalThis.localStorage.getItem('hh-env-probe')).toBe('value');
    globalThis.localStorage.removeItem('hh-env-probe');
    expect(globalThis.localStorage.getItem('hh-env-probe')).toBeNull();
  });

  it('exposes the same localStorage on window, which is what components use', () => {
    // PickupScanPage.tsx and useRecentItems.ts reach for the bare `localStorage`
    // binding; useKioskNavigation.ts reaches for `window.localStorage`. Both
    // resolve through the global, so both have to work.
    expect(window.localStorage).toBe(globalThis.localStorage);
    window.localStorage.setItem('hh-env-probe-window', 'value');
    expect(globalThis.localStorage.getItem('hh-env-probe-window')).toBe('value');
    window.localStorage.removeItem('hh-env-probe-window');
  });
});
