import { type FC, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface MobilePrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  danger?: boolean;
}

export const MobilePrimaryButton: FC<MobilePrimaryButtonProps> = ({
  children,
  danger = false,
  style,
  ...props
}) => {
  const gradient = danger
    ? 'linear-gradient(135deg, var(--color-danger, #dc2626), #991b1b)'
    : 'linear-gradient(135deg, var(--color-hawk-600, #4b2e6e), var(--color-hawk-800, #2d1152))';

  const shadow = danger
    ? '0 4px 16px rgba(220, 38, 38, 0.36)'
    : '0 4px 16px rgba(201, 145, 10, 0.22), 0 2px 8px rgba(45, 17, 82, 0.28)';

  return (
    <>
      <button
        type="button"
        className="mobile-primary-btn"
        style={{
          background: gradient,
          color: 'white',
          border: 'none',
          borderRadius: 12,
          minHeight: 'var(--mobile-touch-min, 56px)',
          padding: '14px 24px',
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.02em',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          boxShadow: shadow,
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
        .mobile-primary-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        @media (min-width: 768px) {
          .mobile-primary-btn {
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
};
