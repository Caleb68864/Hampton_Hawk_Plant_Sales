import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useOnlineStatus } from '../useOnlineStatus.js';

describe('useOnlineStatus', () => {
  const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  function setNavigatorOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    });
  }

  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    if (originalOnline) {
      Object.defineProperty(navigator, 'onLine', originalOnline);
    }
    vi.restoreAllMocks();
  });

  it('returns initial online state from navigator.onLine', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(true);
  });

  it('returns initial offline state when navigator.onLine is false', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(false);
  });

  it('updates to false when offline event fires', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.online).toBe(false);
  });

  it('updates to true when online event fires', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.online).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());

    const onlineAdds = addSpy.mock.calls.filter((c) => c[0] === 'online').length;
    const offlineAdds = addSpy.mock.calls.filter((c) => c[0] === 'offline').length;
    expect(onlineAdds).toBeGreaterThanOrEqual(1);
    expect(offlineAdds).toBeGreaterThanOrEqual(1);

    unmount();

    const onlineRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'online').length;
    const offlineRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'offline').length;
    expect(onlineRemoves).toBeGreaterThanOrEqual(1);
    expect(offlineRemoves).toBeGreaterThanOrEqual(1);
  });
});
