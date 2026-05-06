import { type FC } from 'react';
import { Seed } from './joy/Seed.js';
import { MobileGhostButton } from './buttons/MobileGhostButton.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

interface MobileConnectionRequiredSceneProps {
  onRetry?: () => void;
}

export const MobileConnectionRequiredScene: FC<MobileConnectionRequiredSceneProps> = ({
  onRetry,
}) => {
  const { online } = useOnlineStatus();

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
      <Seed emptyMessage="No connection" size={80} />

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
        We need a connection
      </h1>

      <div
        style={{
          background: 'var(--color-gold-50, #fffbeb)',
          border: '1px solid var(--color-gold-200, #fde68a)',
          borderRadius: 16,
          padding: '20px 24px',
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body, "Manrope", sans-serif)',
            fontSize: 15,
            color: 'var(--color-hawk-700, #3d1f6e)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Hampton Hawks Plant Sales requires an internet connection. Please check your Wi-Fi or
          mobile data and try again.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        role="status"
        aria-live="polite"
        aria-label={online ? 'Connection restored' : 'No connection'}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: online
              ? 'var(--color-success, #16a34a)'
              : 'var(--color-danger, #dc2626)',
            display: 'inline-block',
            boxShadow: online
              ? '0 0 6px rgba(22, 163, 74, 0.5)'
              : '0 0 6px rgba(220, 38, 38, 0.5)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-body, "Manrope", sans-serif)',
            fontSize: 13,
            color: 'var(--color-hawk-600, #4b2e6e)',
            fontWeight: 600,
          }}
        >
          {online ? 'Connected' : 'Offline'}
        </span>
      </div>

      {onRetry && (
        <div style={{ maxWidth: 320, width: '100%' }}>
          <MobileGhostButton onClick={onRetry}>Retry connection</MobileGhostButton>
        </div>
      )}
    </div>
  );
};
