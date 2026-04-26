/**
 * HorizontalBarRow — div-based horizontal bar for inline use in tables.
 *
 * Pure presentational. No transitions on render.
 */
export interface HorizontalBarRowProps {
  value: number;
  max: number;
  color?: string;
  trackColor?: string;
  width?: string;
  ariaLabel?: string;
}

export function HorizontalBarRow({
  value,
  max,
  color = 'bg-hawk-500',
  trackColor = 'bg-hawk-100',
  width = 'w-32',
  ariaLabel,
}: HorizontalBarRowProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div
      className={`relative inline-block h-2 ${width} ${trackColor} rounded-full overflow-hidden align-middle`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={ariaLabel ?? `${value} of ${max}`}
    >
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
