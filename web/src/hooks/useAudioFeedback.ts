import { useCallback, useRef } from 'react';

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = 0.3;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.stop(ctx.currentTime + duration / 1000);
}

export function useAudioFeedback() {
  const enabled = useRef(true);

  const playSuccess = useCallback(() => {
    if (!enabled.current) return;
    playTone(880, 150);
    setTimeout(() => playTone(1100, 200), 150);
  }, []);

  const playError = useCallback(() => {
    if (!enabled.current) return;
    playTone(200, 300, 'square');
  }, []);

  const playWarning = useCallback(() => {
    if (!enabled.current) return;
    playTone(440, 200, 'triangle');
    setTimeout(() => playTone(440, 200, 'triangle'), 250);
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    enabled.current = val;
  }, []);

  return { playSuccess, playError, playWarning, setEnabled };
}
