import { useRef, type FC, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface MobilePageTransitionProps {
  children: ReactNode;
}

export const MobilePageTransition: FC<MobilePageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const keyRef = useRef<string>(location.key);
  const isFirstRender = useRef(true);

  const isNew = keyRef.current !== location.key;
  if (isNew) {
    keyRef.current = location.key;
  }

  if (isFirstRender.current) {
    isFirstRender.current = false;
  }

  return (
    <div
      key={location.key}
      className="mobile-page-transition"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {children}
      <style>{`
        @keyframes mobile-page-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .mobile-page-transition {
          animation: mobile-page-in 220ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-page-transition {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};
