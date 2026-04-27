import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { reportsApi } from '@/api/reports.js';
import { Sparkline } from '@/components/reports/Sparkline.js';
import type { LiveSaleKpiResponse } from '@/types/reports.js';

/**
 * Sale-day live KPI dashboard. Designed for projector display during the sale.
 *
 * - Auto-refreshes every 5 seconds (paused while tab is hidden).
 * - Failures don't blow away the screen: last good payload is retained, and a
 *   small "stale" footer surfaces the staleness.
 * - "X seconds ago" ticker for last-scan refreshes once per second between API
 *   polls so the screen always feels alive.
 * - prefers-reduced-motion: no transitions on number changes (snap updates).
 */

const REFRESH_MS = 5000;

const FONT_DISPLAY = "var(--font-display), 'Fraunces', Georgia, serif";
const FONT_BODY = "var(--font-body), 'Manrope', sans-serif";

export function LiveSaleKpiPage() {
  const [data, setData] = useState<LiveSaleKpiResponse | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [staleSince, setStaleSince] = useState<Date | null>(null);
  const [tick, setTick] = useState(0); // 1Hz tick for "Xs ago" relative labels
  const staleSinceRef = useRef<Date | null>(null);

  // Polling loop. Runs immediately on mount, then on REFRESH_MS interval.
  // While document is hidden we skip fetches (no point burning network for an
  // off-screen tab).
  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const result = await reportsApi.getLiveSaleKpi();
        if (cancelled) return;
        setData(result);
        setLastFetchAt(new Date());
        staleSinceRef.current = null;
        setStaleSince(null);
      } catch {
        // Soft-fail: keep last good data on screen, just mark when staleness began.
        if (cancelled) return;
        if (!staleSinceRef.current) {
          const now = new Date();
          staleSinceRef.current = now;
          setStaleSince(now);
        }
      }
    }

    fetchOnce();
    const interval = window.setInterval(fetchOnce, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // 1Hz ticker for relative-time labels ("3s ago"). Cheap re-render.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lastScanAgo = useMemo(() => {
    if (!data?.lastScanAt) return null;
    const ms = Date.now() - new Date(data.lastScanAt).getTime();
    return Math.max(0, Math.floor(ms / 1000));
    // tick dep ensures re-eval each second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.lastScanAt, tick]);

  const sparklinePoints = useMemo(
    () => (data?.hourlyActivity ?? []).map((b) => b.itemsScanned),
    [data?.hourlyActivity],
  );
  const sparklineMax = useMemo(
    () => Math.max(0, ...sparklinePoints),
    [sparklinePoints],
  );
  const topMoverMax = useMemo(
    () => Math.max(1, ...(data?.topMovers ?? []).map((m) => m.qtyScanned)),
    [data?.topMovers],
  );

  return (
    <div className="paper-grain min-h-screen w-full p-6 lg:p-8">
      <div className="relative z-10 mx-auto max-w-[1920px] space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.32em] text-gold-700"
              style={{ fontFamily: FONT_BODY }}
            >
              Projector
            </p>
            <h1
              className="text-5xl lg:text-6xl text-hawk-900"
              style={{
                fontFamily: FONT_DISPLAY,
                fontVariationSettings: "'opsz' 144, 'wght' 700",
              }}
            >
              Sale Day Live
            </h1>
          </div>
          <div className="text-right">
            <p
              className="text-[11px] uppercase tracking-[0.24em] text-hawk-600"
              style={{ fontFamily: FONT_BODY }}
            >
              Refreshes every 5 seconds
            </p>
            {lastFetchAt && (
              <p className="text-xs text-hawk-500" style={{ fontFamily: FONT_BODY }}>
                Updated {formatTimeShort(lastFetchAt)}
              </p>
            )}
            {staleSince && (
              <p className="text-xs text-amber-700" style={{ fontFamily: FONT_BODY }}>
                Stale since {formatTimeShort(staleSince)}
              </p>
            )}
          </div>
        </header>

        {/* HERO ROW — 4 giant metrics */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <HeroCard
            label="Total Sales"
            value={formatCurrency(data?.totalSalesRevenue ?? 0)}
            accent="gold"
          />
          <HeroCard
            label="Items Scanned Today"
            value={(data?.itemsScannedToday ?? 0).toLocaleString()}
            accent="hawk"
          />
          <HeroCard
            label="Orders Complete"
            value={(data?.ordersCompleted ?? 0).toLocaleString()}
            accent="green"
          />
          <HeroCard
            label="Orders Open"
            value={(data?.ordersOpen ?? 0).toLocaleString()}
            accent="amber"
          />
        </section>

        {/* MID ROW — 3 medium tempo cards */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <TempoCard
            label="Mean Time Between Scans"
            value={
              data?.meanSecondsBetweenScans != null
                ? `${data.meanSecondsBetweenScans.toFixed(1)} sec`
                : '—'
            }
            sub={
              data?.scansLastHour != null
                ? `${data.scansLastHour.toLocaleString()} scans last hour`
                : ''
            }
          />
          <TempoCard
            label="Avg Order Pickup Time"
            value={
              data?.averageOrderPickupSeconds != null
                ? formatDuration(data.averageOrderPickupSeconds)
                : '—'
            }
            sub={
              data?.totalOrdersToday != null
                ? `${data.totalOrdersToday.toLocaleString()} orders today`
                : ''
            }
          />
          <TempoCard
            label="Last Scan"
            value={
              lastScanAgo != null
                ? `${lastScanAgo}s ago`
                : '—'
            }
            sub={data?.lastScanPlantName ?? ''}
          />
        </section>

        {/* BOTTOM ROW — sparkline + top movers + recent scans */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel title="Hourly Activity" eyebrow="Last 12 Hours">
            <div className="space-y-3">
              <Sparkline
                points={sparklinePoints}
                width={520}
                height={120}
                stroke="var(--color-gold-700, #b8811a)"
                fillOpacity={0.2}
                ariaLabel="Items scanned per hour over the last 12 hours"
              />
              <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-hawk-600" style={{ fontFamily: FONT_BODY }}>
                <span>{formatHourLabel(data?.hourlyActivity?.[0]?.hourStart)}</span>
                <span>peak {sparklineMax.toLocaleString()}</span>
                <span>now</span>
              </div>
            </div>
          </Panel>

          <Panel title="Top Movers Today" eyebrow="Leaderboard">
            {data?.topMovers && data.topMovers.length > 0 ? (
              <ol className="space-y-3">
                {data.topMovers.map((row, idx) => {
                  const pct = topMoverMax > 0 ? (row.qtyScanned / topMoverMax) * 100 : 0;
                  return (
                    <li key={`${row.plantName}-${idx}`} className="flex items-center gap-3">
                      <span
                        className="w-6 text-right text-2xl text-gold-700"
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontVariationSettings: "'opsz' 144, 'wght' 700",
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className="truncate text-lg text-hawk-900"
                            style={{ fontFamily: FONT_BODY, fontWeight: 600 }}
                          >
                            {row.plantName || 'Unknown'}
                          </span>
                          <span
                            className="shrink-0 text-2xl text-hawk-900 tabular-nums"
                            style={{
                              fontFamily: FONT_DISPLAY,
                              fontVariationSettings: "'opsz' 144, 'wght' 700",
                            }}
                          >
                            {row.qtyScanned.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-hawk-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyHint label="No scans yet today" />
            )}
          </Panel>

          <Panel title="Recent Scans" eyebrow="Live Ticker">
            {data?.recentScans && data.recentScans.length > 0 ? (
              <ul className="space-y-2">
                {data.recentScans.map((scan, idx) => {
                  const ago = formatRelative(scan.at, tick);
                  // Subtle fade for older entries so the eye lands at the top.
                  const opacity = Math.max(0.45, 1 - idx * 0.07);
                  return (
                    <li
                      key={`${scan.at}-${idx}`}
                      className="flex items-baseline justify-between gap-3 rounded-lg bg-hawk-50/60 px-3 py-2"
                      style={{ opacity }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-base text-hawk-900"
                          style={{ fontFamily: FONT_BODY, fontWeight: 600 }}
                        >
                          {scan.plantName || 'Unknown'}{' '}
                          {scan.quantity > 1 && (
                            <span className="text-hawk-600">×{scan.quantity}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-hawk-600" style={{ fontFamily: FONT_BODY }}>
                          {scan.orderNumber}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-sm text-hawk-700 tabular-nums"
                        style={{ fontFamily: FONT_BODY }}
                      >
                        {ago}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyHint label="No scans yet" />
            )}
          </Panel>
        </section>

        {/* Footer band — secondary stats. */}
        <footer className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FootStat label="Items Scanned (All-Time)" value={(data?.itemsScannedTotal ?? 0).toLocaleString()} />
          <FootStat label="Orders Today" value={(data?.totalOrdersToday ?? 0).toLocaleString()} />
          <FootStat label="Scans Last Hour" value={(data?.scansLastHour ?? 0).toLocaleString()} />
          <FootStat label="Top Mover Qty" value={(data?.topMovers?.[0]?.qtyScanned ?? 0).toLocaleString()} />
        </footer>
      </div>
    </div>
  );
}

// ─── Subcomponents ───

const ACCENT_RING: Record<string, string> = {
  gold: 'border-gold-300 from-gold-50 to-white',
  hawk: 'border-hawk-300 from-hawk-50 to-white',
  green: 'border-emerald-300 from-emerald-50 to-white',
  amber: 'border-amber-300 from-amber-50 to-white',
};

const ACCENT_TEXT: Record<string, string> = {
  gold: 'text-gold-700',
  hawk: 'text-hawk-700',
  green: 'text-emerald-700',
  amber: 'text-amber-700',
};

function HeroCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'gold' | 'hawk' | 'green' | 'amber';
}) {
  return (
    <div
      className={`rounded-3xl border-2 bg-gradient-to-b ${ACCENT_RING[accent]} p-6 joy-shadow-plum`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.28em] ${ACCENT_TEXT[accent]}`}
        style={{ fontFamily: FONT_BODY }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-6xl text-hawk-900 tabular-nums xl:text-7xl 2xl:text-8xl"
        style={{
          fontFamily: FONT_DISPLAY,
          fontVariationSettings: "'opsz' 144, 'wght' 700",
          lineHeight: 1.05,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function TempoCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-hawk-200 bg-white p-5 joy-shadow-plum">
      <p
        className="text-[11px] font-bold uppercase tracking-[0.24em] text-hawk-700"
        style={{ fontFamily: FONT_BODY }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-4xl text-hawk-900 tabular-nums lg:text-5xl"
        style={{
          fontFamily: FONT_DISPLAY,
          fontVariationSettings: "'opsz' 144, 'wght' 700",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-sm text-hawk-600" style={{ fontFamily: FONT_BODY }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hawk-200 bg-white p-5 joy-shadow-plum">
      <p
        className="text-[11px] font-bold uppercase tracking-[0.24em] text-hawk-700"
        style={{ fontFamily: FONT_BODY }}
      >
        {eyebrow}
      </p>
      <h3
        className="mb-3 text-2xl text-hawk-900"
        style={{
          fontFamily: FONT_DISPLAY,
          fontVariationSettings: "'opsz' 144, 'wght' 600",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function FootStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hawk-200 bg-white px-4 py-3">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.24em] text-hawk-600"
        style={{ fontFamily: FONT_BODY }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 text-2xl text-hawk-900 tabular-nums"
        style={{
          fontFamily: FONT_DISPLAY,
          fontVariationSettings: "'opsz' 144, 'wght' 600",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <p
      className="rounded-lg bg-hawk-50/60 px-3 py-6 text-center text-sm text-hawk-600"
      style={{ fontFamily: FONT_BODY }}
    >
      {label}
    </p>
  );
}

// ─── Formatters ───

function formatCurrency(amount: number): string {
  // Compact format kicks in above $10k so giant numbers still fit on the projector.
  if (amount >= 10000) {
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function formatRelative(iso: string, _tick: number): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatHourLabel(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric' });
}

function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
