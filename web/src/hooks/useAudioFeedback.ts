import { useCallback, useRef } from 'react';

export type FeedbackMode = 'loud' | 'quiet' | 'off';

function playTone(
  frequency: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = 'sine',
) {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.stop(ctx.currentTime + duration / 1000);
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
