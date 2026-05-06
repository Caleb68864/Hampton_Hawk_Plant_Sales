import { type FC } from 'react';
import { Seed } from './joy/Seed.js';
import { MobileGhostButton } from './buttons/MobileGhostButton.js';
import { useBackendAvailability } from '../../hooks/useBackendAvailability.js';

export const MobileBackendUnavailableScene: FC = () => {
  const { retry, lastCheckedAt } = useBackendAvailability();

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--joy-paper, #faf7f2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 24,
      }}
    >
      <Seed emptyMessage="Service unavailable" size={80} />

      <h1
        style={{
          fontFamily: 'var(--font-display, "Fraunces", serif)',
          fontSize: 'clamp(1.5rem, 5vw, 2rem)',
          fontWeight: 700,
          color: 'var(--color-hawk-800, #2d1152)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        Service temporarily unavailable
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          fontSize: 15,
          color: 'var(--color-hawk-600, #4b2e6e)',
          textAlign: 'center',
          maxWidth: 340,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        We can't reach the Hampton Hawks server right now. Your internet connection is working — the
        server may be restarting.
      </p>

      {lastCheckedAt && (
        <p
          style={{
            fontFamily: 'var(--font-body, "Manrope", sans-serif)',
            fontSize: 12,
            color: 'var(--color-hawk-400, #9c7ec0)',
            margin: 0,
          }}
        >
          Last checked: {lastCheckedAt.toLocaleTimeString()}
        </p>
      )}

      <div style={{ maxWidth: 320, width: '100%' }}>
        <MobileGhostButton onClick={retry}>Try again</MobileGhostButton>
      </div>
    </div>
  );
};
