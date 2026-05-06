import { type FC, useEffect } from 'react';
import { useJoyAnnounce } from './JoyAriaLive.js';

interface CheckbloomProps {
  visible?: boolean;
  itemName?: string;
  remaining?: number;
}

export const Checkbloom: FC<CheckbloomProps> = ({
  visible = true,
  itemName = 'Item',
  remaining = 0,
}) => {
  const announce = useJoyAnnounce();

  useEffect(() => {
    if (visible) {
      announce(`${itemName} accepted, ${remaining} remaining`, { politeness: 'polite' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="checkbloom"
      role="img"
      aria-label={`${itemName} accepted, ${remaining} remaining`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
    >
      {/* Expanding ring */}
      <div className="checkbloom__ring" aria-hidden="true" />

      {/* Badge */}
      <div
        className="checkbloom__badge"
        aria-hidden="true"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--color-gold-400, #d4a021) 0%, var(--color-gold-600, #a87000) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <svg
          aria-hidden="true"
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
        >
          <polyline
            points="12,28 24,40 44,18"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <span className="sr-only">{`${itemName} accepted, ${remaining} remaining`}</span>

      <style>{`
        .checkbloom {
          position: relative;
          width: 120px;
          height: 120px;
        }
        .checkbloom__badge {
          animation: checkbloom-pop 480ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes checkbloom-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .checkbloom__ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120px;
          height: 120px;
          margin-top: -60px;
          margin-left: -60px;
          border-radius: 50%;
          border: 3px solid var(--color-gold-400, #d4a021);
          opacity: 0;
          animation: checkbloom-ring 700ms ease-out 120ms forwards;
        }
        @keyframes checkbloom-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .checkbloom__badge {
            animation: none !important;
            transform: scale(1);
            opacity: 1;
          }
          .checkbloom__ring {
            animation: none !important;
            transform: scale(1.4);
            opacity: 0.4;
          }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
};
