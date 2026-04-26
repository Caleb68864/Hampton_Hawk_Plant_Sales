import type { ReactNode } from 'react';

export interface BotanicalEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function BotanicalEmptyState({
  title,
  description,
  action,
}: BotanicalEmptyStateProps) {
  return (
    <div className="text-center py-12">
      {/* CSS-only seed glyph */}
      <div
        className="w-20 h-20 mx-auto mb-4"
        style={{
          borderRadius: '50% 50% 50% 5%',
          background:
            'radial-gradient(circle at 30% 30%, var(--color-gold-200), var(--color-gold-500) 70%, var(--color-gold-800))',
          transform: 'rotate(-12deg)',
          boxShadow: '0 14px 30px -14px rgba(184, 129, 26, 0.5)',
        }}
        aria-hidden="true"
      />
      <h3
        className="text-xl text-hawk-900 font-semibold mb-1.5"
        style={{
          fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
          fontVariationSettings: "'wght' 600",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="max-w-[38ch] mx-auto text-sm text-hawk-600"
          style={{
            fontFamily: "var(--font-body), 'Manrope', sans-serif",
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
