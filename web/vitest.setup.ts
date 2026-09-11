import { JSDOM } from 'jsdom';

/**
 * Restore `localStorage` when the Node build has taken it away.
 *
 * Node 26 declares `globalThis.localStorage` as a getter that returns
 * `undefined` unless the process was started with `--localstorage-file`.
 * vitest's jsdom environment copies a window key onto the global only when the
 * global does not already own that key, and `localStorage` is not on its
 * allowlist -- so jsdom's working Storage is dropped on the floor. vitest then
 * aliases `window` to that same global (`document.defaultView === globalThis`),
 * which is why `window.localStorage` is `undefined` as well and why the real
 * jsdom window cannot be reached from here to borrow it back.
 *
 * The symptom is `Cannot read properties of undefined (reading 'getItem')`
 * raised from application components, which reads exactly like application
 * breakage. It is not: on this repository at 2f71128, `npx vitest run` gives
 * 7 failures on Node v26.8.1 and 209/209 with `--localstorage-file` set and no
 * source change at all.
 *
 * What is installed below is jsdom's own `Storage`, taken from a throwaway
 * document -- not a hand-written stand-in -- so tests exercise the same
 * implementation they would have had if vitest had copied it across. The guard
 * means this is a no-op on any Node or vitest where the problem is absent.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const donor = new JSDOM('', { url: 'http://localhost' });
  Object.defineProperty(globalThis, 'localStorage', {
    value: donor.window.localStorage,
    configurable: true,
    writable: true,
  });
}
