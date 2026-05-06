import { type FC } from 'react';
import { Seed } from './joy/Seed.js';
import { MobileGhostButton } from './buttons/MobileGhostButton.js';
import { useAuthStore } from '../../stores/authStore.js';

export const MobileAccessDeniedScene: FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleSignOut = () => {
    void logout();
  };

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
      {/* Hawk-tinted Seed variant */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 80,
            height: 92,
            background:
              'radial-gradient(ellipse 60% 80% at 42% 38%, var(--color-hawk-300, #9b7bc4) 0%, var(--color-hawk-600, #4b2e6e) 100%)',
            borderRadius: '40% 60% 55% 45% / 50% 40% 60% 50%',
            boxShadow:
              '2px 4px 12px rgba(45, 17, 82, 0.28), 0 1px 2px rgba(0,0,0,0.12)',
          }}
        />
        <Seed emptyMessage="Access denied" size={0} />
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display, "Fraunces", serif)',
          fontSize: 'clamp(1.4rem, 5vw, 1.875rem)',
          fontWeight: 700,
          color: 'var(--color-hawk-800, #2d1152)',
          textAlign: 'center',
          margin: 0,
          maxWidth: 340,
        }}
      >
        This account doesn't have mobile access
      </h1>

      {currentUser && (
        <div
          style={{
            background: 'var(--color-hawk-50, #f5f0fa)',
            border: '1px solid var(--color-hawk-200, #c4a8e0)',
            borderRadius: 12,
            padding: '12px 20px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body, "Manrope", sans-serif)',
              fontSize: 14,
              color: 'var(--color-hawk-500, #6b3f8e)',
              margin: 0,
            }}
          >
            Signed in as
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body, "Manrope", sans-serif)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-hawk-800, #2d1152)',
              margin: '4px 0 0',
            }}
          >
            {currentUser.displayName || currentUser.username}
          </p>
        </div>
      )}

      <p
        style={{
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          fontSize: 14,
          color: 'var(--color-hawk-600, #4b2e6e)',
          textAlign: 'center',
          maxWidth: 320,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Contact your administrator to request mobile station access.
      </p>

      <div style={{ maxWidth: 320, width: '100%' }}>
        <MobileGhostButton onClick={handleSignOut}>Sign out</MobileGhostButton>
      </div>
    </div>
  );
};
