/**
 * StackedBar — full-width div with horizontally stacked colored segments.
 * Each segment widens proportionally to its value via flex-grow.
 *
 * Pure presentational. No transitions on render.
 */
export interface StackedBarSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarProps {
  segments: StackedBarSegment[];
  height?: string;
  showLabels?: boolean;
}

export function StackedBar({
  segments,
  height = 'h-10',
  showLabels = true,
}: StackedBarProps) {
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  if (positive.length === 0 || total <= 0) {
    return (
      <div className={`flex w-full ${height} rounded-md overflow-hidden bg-hawk-100`} aria-label="Empty stacked bar" />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex w-full ${height} rounded-md overflow-hidden border border-hawk-200`}
        role="img"
        aria-label={`Stacked bar with ${positive.length} segments`}
      >
        {positive.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          const labelText = `${seg.label} (${seg.value.toLocaleString()}, ${pct.toFixed(0)}%)`;
          return (
            <div
              key={`${seg.label}-${i}`}
              className={`${seg.color} flex items-center justify-center px-2 text-xs font-semibold text-white tabular-nums whitespace-nowrap overflow-hidden`}
              style={{ flexGrow: seg.value, flexBasis: 0 }}
              title={labelText}
            >
              {showLabels && pct >= 8 ? labelText : null}
            </div>
          );
        })}
      </div>
      {showLabels && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-hawk-700 tabular-nums">
          {segments.map((seg, i) => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <li key={`legend-${seg.label}-${i}`} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${seg.color}`}
                />
                <span>
                  {seg.label}{' '}
                  <span className="text-hawk-600">
                    ({seg.value.toLocaleString()}, {pct.toFixed(0)}%)
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
