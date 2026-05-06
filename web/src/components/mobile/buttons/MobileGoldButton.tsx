import { type FC, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface MobileGoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export const MobileGoldButton: FC<MobileGoldButtonProps> = ({
  children,
  style,
  ...props
}) => {
  return (
    <>
      <button
        type="button"
        className="mobile-gold-btn"
        style={{
          background: 'linear-gradient(135deg, var(--color-gold-300, #f0c84a), var(--color-gold-500, #c9910a))',
          color: 'var(--color-hawk-950, #0d0520)',
          border: 'none',
          borderRadius: 12,
          minHeight: 'var(--mobile-touch-min, 56px)',
          padding: '14px 24px',
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.02em',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 3px 12px rgba(201, 145, 10, 0.28)',
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
        .mobile-gold-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        @media (min-width: 768px) {
          .mobile-gold-btn {
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
};
