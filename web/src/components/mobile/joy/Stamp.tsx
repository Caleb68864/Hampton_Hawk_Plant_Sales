import { type FC, useEffect } from 'react';
import { useJoyAnnounce } from './JoyAriaLive.js';

interface StampProps {
  orderNumber?: string;
  label?: string;
}

export const Stamp: FC<StampProps> = ({ orderNumber = '', label = 'COMPLETE' }) => {
  const announce = useJoyAnnounce();

  useEffect(() => {
    announce(`Order ${orderNumber} complete`, { politeness: 'polite' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="joy-stamp"
      role="img"
      aria-label={`Order ${orderNumber} complete`}
    >
      <div className="joy-stamp__inner" aria-hidden="true">
        <span className="joy-stamp__text">{label}</span>
        {orderNumber && (
          <span className="joy-stamp__order">#{orderNumber}</span>
        )}
      </div>
      <span className="sr-only">{`Order ${orderNumber} complete`}</span>

      <style>{`
        .joy-stamp {
          display: inline-block;
          position: relative;
        }
        .joy-stamp__inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 18px;
          border: 2.5px dashed var(--color-gold-600, #a87000);
          border-radius: 4px;
          font-family: var(--font-display, "Fraunces", serif);
          font-style: italic;
          color: var(--color-gold-600, #a87000);
          animation: stamp-appear 240ms ease-out forwards;
          transform-origin: center;
        }
        .joy-stamp__text {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.12em;
          line-height: 1;
        }
        .joy-stamp__order {
          font-size: 13px;
          letter-spacing: 0.08em;
          margin-top: 2px;
          opacity: 0.75;
        }
        @keyframes stamp-appear {
          0% { transform: rotate(-12deg) scale(0.7); opacity: 0; }
          70% { transform: rotate(3deg) scale(1.05); opacity: 0.9; }
          100% { transform: rotate(-6deg) scale(1); opacity: 1; }
        }
        @media (min-width: 768px) {
          .joy-stamp__text {
            font-size: 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .joy-stamp__inner {
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
