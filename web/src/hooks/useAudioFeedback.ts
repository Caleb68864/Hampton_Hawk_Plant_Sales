import { useCallback, useRef } from 'react';

export type FeedbackMode = 'loud' | 'quiet' | 'off';

// One shared AudioContext for the whole session. Browsers cap the number of
// live contexts (Chrome: ~6 per page) and creating one per tone -- never
// closed -- silently exhausted the cap after a few dozen scans, after which
// every beep failed. iOS also starts contexts suspended until a user gesture,
// so the shared context is resumed on every use.
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== 'closed') return sharedContext;
  try {
    if (typeof AudioContext === 'undefined') return null;
    sharedContext = new AudioContext();
    return sharedContext;
  } catch {
    // Constructor can throw (unsupported, or the cap was hit by other code).
    return null;
  }
}

/** Test seam: forget the shared context so the next tone creates a fresh one. */
export function resetAudioFeedbackContextForTests(): void {
  sharedContext = null;
}

function playTone(
  frequency: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = 'sine',
) {
  // Audio is best-effort feedback: nothing here may throw into the scan
  // handler that called it, or a broken speaker path would break scanning.
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Still blocked by autoplay policy; the tone is simply not heard.
      });
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const stopAt = ctx.currentTime + duration / 1000;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, stopAt);
    osc.stop(stopAt);
    // Release the nodes once the tone has ended so they do not accumulate on
    // the shared context.
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    // Swallow: see above.
  }
}

export function useAudioFeedback() {
  const mode = useRef<FeedbackMode>('loud');

  const getGain = useCallback(() => {
    if (mode.current === 'quiet') return 0.12;
    if (mode.current === 'loud') return 0.3;
    return 0;
  }, []);

  const playSuccess = useCallback(() => {
    if (mode.current === 'off') return;
    const gain = getGain();
    playTone(880, 150, gain);
    setTimeout(() => playTone(1100, 200, gain), 150);
  }, [getGain]);

  const playError = useCallback(() => {
    if (mode.current === 'off') return;
    playTone(200, 300, getGain(), 'square');
  }, [getGain]);

  const playWarning = useCallback(() => {
    if (mode.current === 'off') return;
    const gain = getGain();
    playTone(440, 200, gain, 'triangle');
    setTimeout(() => playTone(440, 200, gain, 'triangle'), 250);
  }, [getGain]);

  const setMode = useCallback((val: FeedbackMode) => {
    mode.current = val;
  }, []);

  return { playSuccess, playError, playWarning, setMode };
}
