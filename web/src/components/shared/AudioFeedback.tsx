import type { ReactNode } from 'react';
import { useAudioFeedback } from '@/hooks/useAudioFeedback.js';
import { AudioFeedbackContext } from './audioFeedbackContext.js';

export function AudioFeedbackProvider({ children }: { children: ReactNode }) {
  const audio = useAudioFeedback();

  return (
    <AudioFeedbackContext.Provider value={audio}>
      {children}
    </AudioFeedbackContext.Provider>
  );
}
