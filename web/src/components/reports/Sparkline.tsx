/**
 * Sparkline — pure SVG line chart with optional fill area below.
 *
 * Presentational only; no API calls. Honors prefers-reduced-motion implicitly
 * by avoiding any CSS transitions or animations on render.
 *
 * Edge cases:
 * - Empty array  → renders empty <svg> (no error).
 * - Single point → renders a centered dot, no line.
 */
export interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fillOpacity?: number;
  ariaLabel?: string;
}

export function Sparkline({
  points,
  width = 200,
  height = 40,
  stroke = 'var(--color-hawk-700)',
  fillOpacity = 0.15,
  ariaLabel,
}: SparklineProps) {
  const viewBox = `0 0 ${width} ${height}`;

  if (!points || points.length === 0) {
    return (
      <svg
        role="img"
        aria-label={ariaLabel ?? 'Empty sparkline'}
        width={width}
        height={height}
        viewBox={viewBox}
        preserveAspectRatio="none"
      />
    );
  }

  if (points.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        role="img"
        aria-label={ariaLabel ?? 'Sparkline with single point'}
        width={width}
        height={height}
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        <circle cx={cx} cy={cy} r={3} fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((value, idx) => {
    const x = idx * stepX;
    // y is inverted (SVG 0 at top); leave 1px padding so the stroke isn't clipped.
    const y = height - 1 - ((value - min) / range) * (height - 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${(width).toFixed(2)},${height} L0,${height} Z`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? `Sparkline of ${points.length} points`}
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={stroke} fillOpacity={fillOpacity} stroke="none" />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
