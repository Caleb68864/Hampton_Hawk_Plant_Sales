import { type FC, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface QuickActionCardProps {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  enabled: boolean;
  comingSoon?: boolean;
}

export const MobileQuickActionCard: FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  path,
  enabled,
  comingSoon = false,
}) => {
  const navigate = useNavigate();
  const disabled = !enabled || comingSoon;

  return (
    <>
      <div
        className={`qa-card${disabled ? ' qa-card--disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={() => { if (!disabled) navigate(path); }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            navigate(path);
          }
        }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          background: 'var(--joy-paper, #fff)',
          borderRadius: 14,
          padding: '14px 16px 14px 20px',
          minHeight: 'var(--mobile-touch-min, 56px)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          outline: 'none',
        }}
      >
        {/* Left-edge gradient bar */}
        <div
          className="qa-card__bar"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 4,
            bottom: 0,
            borderRadius: '14px 0 0 14px',
            background: 'linear-gradient(to bottom, var(--color-gold-400, #d4a021), var(--color-hawk-600, #4b2e6e))',
          }}
        />

        {/* Icon tile */}
        <div
          className="qa-card__icon"
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--color-hawk-50, #f5f0fa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-hawk-600, #4b2e6e)',
          }}
        >
          {icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display, "Fraunces", serif)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-hawk-900, #1e0a35)',
              lineHeight: 1.2,
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body, "Manrope", sans-serif)',
              fontSize: 13,
              color: '#6b5573',
              lineHeight: 1.4,
            }}
          >
            {comingSoon ? 'Coming soon' : description}
          </div>
        </div>

        {/* Chevron */}
        {!disabled && (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-hawk-300, #a078c8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>

      <style>{`
        .qa-card:focus-visible {
          outline: 2px solid var(--color-gold-500, #c9910a);
          outline-offset: 2px;
        }
        .qa-card__bar {
          transform: scaleY(0);
          transform-origin: top;
          transition: transform 200ms ease;
        }
        .qa-card:active .qa-card__bar {
          transform: scaleY(1);
        }
        .qa-card--disabled .qa-card__bar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .qa-card__bar {
            transform: scaleY(1) !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
};
