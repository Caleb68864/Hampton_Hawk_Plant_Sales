import { type FC, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface MobilePageTransitionProps {
  children: ReactNode;
}

export const MobilePageTransition: FC<MobilePageTransitionProps> = ({ children }) => {
  const location = useLocation();

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
