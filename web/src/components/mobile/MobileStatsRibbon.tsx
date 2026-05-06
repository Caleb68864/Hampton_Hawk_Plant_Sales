import { type FC } from 'react';

export interface StatItem {
  label: string;
  value: number | string;
  unit?: string;
}

interface MobileStatsRibbonProps {
  stats: StatItem[];
}

export const MobileStatsRibbon: FC<MobileStatsRibbonProps> = ({ stats }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        background: 'var(--joy-paper, #fff)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 8px',
            borderLeft: i > 0 ? '1px solid var(--color-rule, #e8e0f0)' : 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", monospace)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--color-hawk-800, #2d1152)',
              lineHeight: 1,
            }}
          >
            {stat.value}
            {stat.unit && (
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2 }}>
                {stat.unit}
              </span>
            )}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body, "Manrope", sans-serif)',
              fontSize: 11,
              color: 'var(--color-hawk-400, #8a68a8)',
              marginTop: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: 'center',
            }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
};
