/**
 * Donut — SVG donut chart rendered as concentric stroke arcs on a single circle
 * via stroke-dasharray + stroke-dashoffset.
 *
 * Presentational only. No animations on render (honors prefers-reduced-motion).
 *
 * Edge cases:
 * - Single segment → renders as a complete ring of that color.
 * - All-zero values → renders a faint grey ring with center text only.
 */
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({
  segments,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerValue,
}: DonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const total = segments.reduce((sum, s) => sum + (s.value > 0 ? s.value : 0), 0);
  const isAllZero = total <= 0;

  const positiveSegments = segments.filter((s) => s.value > 0);
  const isSingle = positiveSegments.length === 1;

  // Track for visual continuity — rendered behind any segments.
  const trackColor = 'var(--color-hawk-100, #e8e3ee)';

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={centerLabel ? `${centerLabel} donut chart` : 'Donut chart'}
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {!isAllZero && isSingle && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={positiveSegments[0]!.color}
              strokeWidth={strokeWidth}
            />
          )}

          {!isAllZero && !isSingle && (
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {(() => {
                let cumulative = 0;
                return positiveSegments.map((seg, i) => {
                  const fraction = seg.value / total;
                  const dashLen = fraction * circumference;
                  const dashGap = circumference - dashLen;
                  const offset = -cumulative * circumference;
                  cumulative += fraction;
                  return (
                    <circle
                      key={`${seg.label}-${i}`}
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${dashLen} ${dashGap}`}
                      strokeDashoffset={offset}
                    />
                  );
                });
              })()}
            </g>
          )}
        </svg>

        {(centerLabel || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
            {centerValue && (
              <span
                className="text-2xl text-hawk-900 leading-tight"
                style={{
                  fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                  fontVariationSettings: "'opsz' 144, 'wght' 600",
                }}
              >
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-hawk-700 mt-0.5"
                style={{
                  fontFamily: "var(--font-body), 'Manrope', sans-serif",
                }}
              >
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {segments.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-hawk-700 tabular-nums">
          {segments.map((seg, i) => (
            <li key={`${seg.label}-${i}`} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              <span>
                {seg.label} <span className="text-hawk-600">({seg.value.toLocaleString()})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
