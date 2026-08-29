import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBarcodeScanner } from '../useBarcodeScanner';

// ── Shared mutable state accessible inside vi.mock factory ────────────────
const state = vi.hoisted(() => ({
  cb: null as ((r: unknown, e?: unknown) => void) | null,
  trackStop: vi.fn(),
  controlsStop: vi.fn(),
  throwOnDecode: null as Error | null,
  // When set, decodeFromConstraints waits on it before "acquiring" the camera,
  // so a test can stop()/unmount while the acquisition is still pending.
  decodeGate: null as Promise<void> | null,
  lastVideoEl: null as HTMLVideoElement | null,
}));

vi.mock('@zxing/browser', () => {
  class MockBrowserMultiFormatReader {
    async decodeFromConstraints(
      _c: unknown,
      el: HTMLVideoElement,
      cb: (r: unknown, e?: unknown) => void,
    ) {
      if (state.decodeGate) await state.decodeGate;
      if (state.throwOnDecode) throw state.throwOnDecode;
      state.cb = cb;
      state.lastVideoEl = el;
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
    state.decodeGate = null;
    state.lastVideoEl = null;
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

  it('(e) latest onScan is used even though the decode callback was registered once at start()', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onScan }: { onScan: (r: unknown) => void }) => useBarcodeScanner({ onScan }),
      { initialProps: { onScan: first } },
    );

    await act(async () => { await result.current.start(); });
    rerender({ onScan: second });

    act(() => { state.cb!(makeScanResult('NEW')); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('(f) backgrounding releases the camera and returning re-acquires it', async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('active');

    const setVisibility = (value: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    act(() => { setVisibility('hidden'); });
    expect(state.trackStop).toHaveBeenCalled();
    expect(state.controlsStop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');

    state.cb = null;
    await act(async () => { setVisibility('visible'); });

    expect(result.current.status).toBe('active');
    expect(state.cb).not.toBeNull();
  });

  it('(g) stop() during a pending start() releases the late-arriving camera stream', async () => {
    let openGate: () => void = () => {};
    state.decodeGate = new Promise<void>((resolve) => { openGate = resolve; });

    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    let startDone: Promise<void> = Promise.resolve();
    await act(async () => {
      startDone = result.current.start();
      // Let listVideoInputDevices resolve so the hidden <video> exists and the
      // decode is what is pending.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('requesting-permission');

    // Volunteer navigates away (or the page hides) before the camera answers.
    act(() => { result.current.stop(); });
    expect(result.current.status).toBe('idle');

    await act(async () => {
      openGate();
      await startDone;
    });

    // The stream that arrived after stop() must be torn down, not adopted.
    expect(state.controlsStop).toHaveBeenCalled();
    expect(state.trackStop).toHaveBeenCalled();
    expect(state.lastVideoEl?.parentElement).toBeNull();
    expect(state.lastVideoEl?.srcObject).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('(h) unmount during a pending start() releases the late-arriving camera stream', async () => {
    let openGate: () => void = () => {};
    state.decodeGate = new Promise<void>((resolve) => { openGate = resolve; });

    const onScan = vi.fn();
    const { result, unmount } = renderHook(() => useBarcodeScanner({ onScan }));

    let startDone: Promise<void> = Promise.resolve();
    await act(async () => {
      startDone = result.current.start();
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      openGate();
      await startDone;
    });

    expect(state.controlsStop).toHaveBeenCalled();
    expect(state.trackStop).toHaveBeenCalled();
    expect(state.lastVideoEl?.parentElement).toBeNull();
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
