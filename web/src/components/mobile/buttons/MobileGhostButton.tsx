import { type FC, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface MobileGhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export const MobileGhostButton: FC<MobileGhostButtonProps> = ({
  children,
  style,
  ...props
}) => {
  return (
    <>
      <button
        type="button"
        className="mobile-ghost-btn"
        style={{
          background: 'white',
          color: 'var(--color-hawk-800, #2d1152)',
          border: '1px solid var(--color-hawk-200, #c4a8e0)',
          borderRadius: 12,
          minHeight: 'var(--mobile-touch-min, 56px)',
          padding: '14px 24px',
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: '0.02em',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'none',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: props.disabled ? 0.55 : 1,
          ...style,
        }}
        {...props}
      >
        {children}
      </button>

      <style>{`
        .mobile-ghost-btn:active:not(:disabled) {
          transform: translateY(1px);
          background: var(--color-hawk-50, #f5f0fa);
        }
        @media (min-width: 768px) {
          .mobile-ghost-btn {
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
};
