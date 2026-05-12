import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBarcodeScanner } from '../useBarcodeScanner';

// ── Shared mutable state accessible inside vi.mock factory ────────────────
const state = vi.hoisted(() => ({
  cb: null as ((r: unknown, e?: unknown) => void) | null,
  trackStop: vi.fn(),
  controlsStop: vi.fn(),
  throwOnDecode: null as Error | null,
}));

vi.mock('@zxing/browser', () => {
  class MockBrowserMultiFormatReader {
    async decodeFromConstraints(
      _c: unknown,
      el: HTMLVideoElement,
      cb: (r: unknown, e?: unknown) => void,
    ) {
      if (state.throwOnDecode) throw state.throwOnDecode;
      state.cb = cb;
      const track = { stop: state.trackStop, kind: 'video' };
      const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
      // Use the setter on the fake video element (injected via document.createElement mock)
      (el as unknown as { srcObject: unknown }).srcObject = stream;
      return { stop: state.controlsStop };
    }
    async decodeFromVideoDevice() {
      return { stop: state.controlsStop };
    }
    static async listVideoInputDevices() {
      return [{ deviceId: 'dev-1', label: 'Camera 1' }];
    }
  }
  return { BrowserMultiFormatReader: MockBrowserMultiFormatReader };
});

// ── Fake video element: wraps a <div> with a proper srcObject getter/setter
// so we bypass jsdom's MediaStream-only prototype setter on HTMLVideoElement.
function makeFakeVideoEl(): HTMLVideoElement {
  let _srcObject: unknown = null;
  const el = document.createElement('div') as unknown as HTMLVideoElement;
  Object.defineProperty(el, 'srcObject', {
    get: () => _srcObject,
    set: (v: unknown) => { _srcObject = v; },
    configurable: true,
  });
  el.setAttribute = vi.fn() as typeof el.setAttribute;
  return el;
}

function makeScanResult(code = '12345') {
  return { getText: () => code, getBarcodeFormat: () => 0 };
}

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.cb = null;
    state.trackStop.mockReset();
    state.controlsStop.mockReset();
    state.throwOnDecode = null;
    vi.stubGlobal('isSecureContext', true);

    // Patch document.createElement so the hook's internal video element
    // has a controllable srcObject property.
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        if (tag === 'video') return makeFakeVideoEl();
        return orig(tag, options);
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('(a) duplicate scan within cooldownMs does not invoke onScan a second time', async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() =>
      useBarcodeScanner({ onScan, cooldownMs: 1000 }),
    );

    await act(async () => { await result.current.start(); });
    expect(state.cb).not.toBeNull();

    // First scan
    act(() => { state.cb!(makeScanResult('ABC')); });
    expect(onScan).toHaveBeenCalledTimes(1);

    // Same code 500 ms later — still within cooldown → suppressed
    vi.advanceTimersByTime(500);
    act(() => { state.cb!(makeScanResult('ABC')); });
    expect(onScan).toHaveBeenCalledTimes(1);

    // Same code 600 ms further (total 1100 ms) — past cooldown → fires
    vi.advanceTimersByTime(600);
    act(() => { state.cb!(makeScanResult('ABC')); });
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it('(b) when paused: true, decode results do not invoke onScan', async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() =>
      useBarcodeScanner({ onScan, paused: true }),
    );

    await act(async () => { await result.current.start(); });
    act(() => { state.cb!(makeScanResult('XYZ')); });

    expect(onScan).not.toHaveBeenCalled();
  });

  it('(c) permission-denied error sets status "error" and error.kind "permission-denied"', async () => {
    const permError = Object.assign(new Error('Permission denied'), {
      name: 'NotAllowedError',
    });
    state.throwOnDecode = permError;

    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.kind).toBe('permission-denied');
  });

  it('(d) calling stop() invokes track.stop() on all active tracks', async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    await act(async () => { await result.current.start(); });
    act(() => { result.current.stop(); });

    expect(state.trackStop).toHaveBeenCalled();
  });

  it('insecure-context: start() short-circuits without calling decodeFromConstraints', async () => {
    vi.stubGlobal('isSecureContext', false);

    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.kind).toBe('insecure-context');
    // state.cb is only set inside decodeFromConstraints — if never called it stays null
    expect(state.cb).toBeNull();
  });
});
