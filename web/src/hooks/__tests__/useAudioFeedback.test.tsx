import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioFeedback, resetAudioFeedbackContextForTests } from '../useAudioFeedback.js';

function makeFakeAudioContext(initialState: 'running' | 'suspended' = 'running') {
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
    frequency: { value: 0 },
    gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
    onended: null as null | (() => void),
  });
  const ctx = {
    state: initialState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    createOscillator: vi.fn(node),
    createGain: vi.fn(node),
  };
  return ctx;
}

describe('useAudioFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAudioFeedbackContextForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a single shared AudioContext across many tones', () => {
    const contexts: ReturnType<typeof makeFakeAudioContext>[] = [];
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        const ctx = makeFakeAudioContext();
        contexts.push(ctx);
        return ctx;
      }),
    );

    const { result } = renderHook(() => useAudioFeedback());
    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.playSuccess();
        result.current.playError();
        result.current.playWarning();
      }
      vi.runAllTimers();
    });

    expect(contexts).toHaveLength(1);
    // Success + warning each play two tones, error one: 5 tones per loop.
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(100);
  });

  it('resumes a suspended context before playing (iOS autoplay policy)', () => {
    const ctx = makeFakeAudioContext('suspended');
    vi.stubGlobal('AudioContext', vi.fn(() => ctx));

    const { result } = renderHook(() => useAudioFeedback());
    act(() => {
      result.current.playError();
    });

    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('does not throw into the caller when AudioContext cannot be created', () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => {
        throw new Error('The number of hardware contexts provided (6) is greater than or equal to the maximum bound (6).');
      }),
    );

    const { result } = renderHook(() => useAudioFeedback());
    expect(() => {
      act(() => {
        result.current.playSuccess();
        result.current.playError();
        result.current.playWarning();
        vi.runAllTimers();
      });
    }).not.toThrow();
  });

  it('plays nothing in "off" mode', () => {
    const ctx = makeFakeAudioContext();
    vi.stubGlobal('AudioContext', vi.fn(() => ctx));

    const { result } = renderHook(() => useAudioFeedback());
    act(() => {
      result.current.setMode('off');
      result.current.playSuccess();
      vi.runAllTimers();
    });

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});
