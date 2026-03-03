import { createContext, useContext, type ReactNode } from 'react';
import { useAudioFeedback, type FeedbackMode } from '@/hooks/useAudioFeedback.js';

interface AudioFeedbackContextValue {
  playSuccess: () => void;
  playError: () => void;
  playWarning: () => void;
  setMode: (val: FeedbackMode) => void;
}

const AudioFeedbackContext = createContext<AudioFeedbackContextValue | null>(null);

export function AudioFeedbackProvider({ children }: { children: ReactNode }) {
  const audio = useAudioFeedback();

  return (
    <AudioFeedbackContext.Provider value={audio}>
      {children}
    </AudioFeedbackContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioFeedbackContext);
  if (!ctx) throw new Error('useAudio must be used within AudioFeedbackProvider');
  return ctx;
}
