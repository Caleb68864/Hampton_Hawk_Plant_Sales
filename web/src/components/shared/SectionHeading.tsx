import type { ReactNode } from 'react';

export interface SectionHeadingProps {
  level?: 1 | 2 | 3;
  eyebrow?: string;
  accent?: string;
  children: ReactNode;
}

const sizeClasses: Record<1 | 2 | 3, string> = {
  1: 'text-5xl',
  2: 'text-4xl',
  3: 'text-2xl',
};

export function SectionHeading({
  level = 2,
  eyebrow,
  accent,
  children,
}: SectionHeadingProps) {
  const Tag = `h${level}` as const;

  const headingStyle = {
    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
    fontVariationSettings: "'opsz' 144, 'SOFT' 80, 'wght' 500",
    letterSpacing: '-0.015em',
  };

  return (
    <div>
      {eyebrow && (
        <span
          className="block text-xs font-bold uppercase tracking-[0.28em] text-hawk-700 mb-1"
          style={{
            fontFamily: "var(--font-body), 'Manrope', sans-serif",
          }}
        >
          {eyebrow}
        </span>
      )}
      <Tag className={`${sizeClasses[level]} text-hawk-900`} style={headingStyle}>
        {children}
        {accent && (
          <em className="text-gold-700 italic font-semibold not-italic ml-1" style={headingStyle}>
            {accent}
          </em>
        )}
      </Tag>
    </div>
  );
}
