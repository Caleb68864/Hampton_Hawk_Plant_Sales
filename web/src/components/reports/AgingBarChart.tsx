/**
 * AgingBarChart — 4 vertical bars side-by-side keyed on bucket name.
 *
 * Color map per bucket label:
 *   <24h  → green-500
 *   1-3d  → blue-500
 *   3-7d  → amber-500
 *   >7d   → red-500
 *
 * Bars scale to the max count among the four buckets. Empty buckets still
 * render an 8px stub so the layout stays continuous.
 *
 * Pure presentational. No transitions on render.
 */
export interface AgingBucket {
  bucket: string;
  count: number;
  oldestAgeHours: number;
}

export interface AgingBarChartProps {
  buckets: AgingBucket[];
  height?: number;
}

const BUCKET_COLORS: Record<string, string> = {
  '<24h': 'bg-green-500',
  '1-3d': 'bg-blue-500',
  '3-7d': 'bg-amber-500',
  '>7d': 'bg-red-500',
};

const FALLBACK_COLOR = 'bg-hawk-400';

export function AgingBarChart({ buckets, height = 140 }: AgingBarChartProps) {
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const safeMax = maxCount > 0 ? maxCount : 1;

  return (
    <div
      className="flex items-end justify-around gap-3 rounded-md border border-hawk-200 bg-white p-4"
      role="img"
      aria-label="Order age buckets"
    >
      {buckets.map((b) => {
        const colorClass = BUCKET_COLORS[b.bucket] ?? FALLBACK_COLOR;
        // Scale to max; floor to 8px so empty buckets stay visible.
        const px = b.count > 0 ? Math.max(8, Math.round((b.count / safeMax) * height)) : 8;
        return (
          <div key={b.bucket} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-xs font-semibold text-hawk-900 tabular-nums">
              {b.count.toLocaleString()}
            </span>
            <div
              className={`${colorClass} w-full max-w-[64px] rounded-t-sm`}
              style={{ height: `${px}px` }}
              title={`${b.bucket}: ${b.count} order${b.count === 1 ? '' : 's'}`}
            />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-hawk-700 tabular-nums">
              {b.bucket}
            </span>
          </div>
        );
      })}
    </div>
  );
}
