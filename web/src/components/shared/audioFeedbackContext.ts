import { createContext, useContext } from 'react';
import type { FeedbackMode } from '@/hooks/useAudioFeedback.js';

export interface AudioFeedbackContextValue {
  playSuccess: () => void;
  playError: () => void;
  playWarning: () => void;
  setMode: (val: FeedbackMode) => void;
}

export const AudioFeedbackContext = createContext<AudioFeedbackContextValue | null>(null);

export function useAudio(): AudioFeedbackContextValue {
  const ctx = useContext(AudioFeedbackContext);
  if (!ctx) throw new Error('useAudio must be used within AudioFeedbackProvider');
  return ctx;
}
