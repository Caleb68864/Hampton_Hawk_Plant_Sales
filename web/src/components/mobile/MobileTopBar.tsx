import type { FC } from 'react';

interface ConnectionStatus {
  status: 'online' | 'checking' | 'offline';
}

interface MobileTopBarProps {
  onMenuOpen: () => void;
  stationName?: string;
  connectionStatus?: ConnectionStatus['status'];
}

const ConnectionDot: FC<{ status: ConnectionStatus['status'] }> = ({ status }) => {
  const base =
    'inline-block rounded-full flex-shrink-0';

  if (status === 'online') {
    return (
      <span
        aria-label="Connected"
        role="status"
        className={base}
        style={{ width: 8, height: 8, background: 'var(--color-gold-500)' }}
      />
    );
  }

  if (status === 'checking') {
    return (
      <span
        aria-label="Checking connection"
        role="status"
        className={base}
        style={{ width: 8, height: 8, background: 'var(--color-hawk-300)' }}
      />
    );
  }

  return (
    <span
      aria-label="Offline"
      role="status"
      className={`${base} mobile-connection-dot-offline`}
      style={{ width: 8, height: 8, background: 'var(--color-danger, #dc2626)' }}
    />
  );
};

export const MobileTopBar: FC<MobileTopBarProps> = ({
  onMenuOpen,
  stationName = 'Hampton Hawks',
  connectionStatus = 'checking',
}) => {
  return (
    <header
      className="mobile-top-bar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 16,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'linear-gradient(to right, var(--color-hawk-700), var(--color-hawk-950))',
        borderBottom: '3px solid var(--color-gold-300)',
        color: 'white',
      }}
    >
      {/* Hamburger — hidden on tablet */}
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={onMenuOpen}
        className="mobile-hamburger"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Station name */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-display, serif)',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {stationName}
      </span>

      {/* Connection dot */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <ConnectionDot status={connectionStatus} />
      </div>

      <style>{`
        .mobile-top-bar {
          height: 48px;
        }
        @media (min-width: 768px) {
          .mobile-top-bar {
            height: 56px;
          }
          .mobile-hamburger {
            display: none !important;
          }
        }
        .mobile-connection-dot-offline {
          animation: mobile-dot-pulse 1.4s ease-in-out infinite;
        }
        @keyframes mobile-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mobile-connection-dot-offline {
            animation: none !important;
          }
        }
      `}</style>
    </header>
  );
};
