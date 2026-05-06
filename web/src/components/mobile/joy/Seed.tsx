import { type FC, useEffect } from 'react';
import { useJoyAnnounce } from './JoyAriaLive.js';

interface SeedProps {
  emptyMessage?: string;
  size?: number;
}

export const Seed: FC<SeedProps> = ({
  emptyMessage = 'Nothing here yet',
  size = 72,
}) => {
  const announce = useJoyAnnounce();

  useEffect(() => {
    announce(emptyMessage, { politeness: 'polite' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="joy-seed"
      role="img"
      aria-label={emptyMessage}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="joy-seed__shape"
        aria-hidden="true"
        style={{
          width: size,
          height: Math.round(size * 1.15),
        }}
      />
      <span className="sr-only">{emptyMessage}</span>

      <style>{`
        .joy-seed__shape {
          background: radial-gradient(ellipse 60% 80% at 42% 38%, var(--color-gold-300, #f0c84a) 0%, var(--color-gold-500, #c9910a) 100%);
          border-radius: 40% 60% 55% 45% / 50% 40% 60% 50%;
          box-shadow: 2px 4px 12px rgba(201, 145, 10, 0.28), 0 1px 2px rgba(0,0,0,0.12);
          animation: seed-float 3.6s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        @keyframes seed-float {
          0%, 100% { transform: rotate(-8deg) translateY(0); }
          50% { transform: rotate(4deg) translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .joy-seed__shape {
            animation: none !important;
            transform: none !important;
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
