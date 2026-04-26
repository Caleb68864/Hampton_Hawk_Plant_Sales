import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { Sparkline } from '@/components/reports/Sparkline.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { DailySalesDay } from '@/types/reports.js';
import { exportToCsv } from '@/utils/csvExport.js';

type SortKey = keyof DailySalesDay;
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'date', label: 'Date', align: 'left' },
  { key: 'orderCount', label: 'Orders', align: 'right' },
  { key: 'itemCount', label: 'Items', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'walkUpCount', label: 'WalkUp', align: 'right' },
  { key: 'preorderCount', label: 'Preorder', align: 'right' },
];

function defaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 30);
  return {
    from: past.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export function DailySalesPage() {
  const [{ from, to }, setRange] = useState(defaultDateRange);
  const [rows, setRows] = useState<DailySalesDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getDailySales(from, to)
      .then((result) => setRows(result.days))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load daily sales report.'))
      .finally(() => setLoading(false));
  }, [from, to, refreshTick]);

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  // Sparklines always read days in chronological order regardless of table sort.
  const chronologicalDays = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  );
  const revenuePoints = useMemo(() => chronologicalDays.map((d) => d.revenue), [chronologicalDays]);
  const itemPoints = useMemo(() => chronologicalDays.map((d) => d.itemCount), [chronologicalDays]);
  const orderPoints = useMemo(() => chronologicalDays.map((d) => d.orderCount), [chronologicalDays]);
  const allRevenueZero = revenuePoints.every((v) => v === 0);
  const leftPoints = allRevenueZero ? itemPoints : revenuePoints;
  const leftLabel = allRevenueZero ? 'Items' : 'Revenue';
  const leftStroke = allRevenueZero ? 'var(--color-hawk-700)' : 'var(--color-gold-600)';

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(typeof rows[0]?.[key] === 'number' ? 'desc' : 'asc');
    }
  }

  function handleDownloadCsv() {
    const headers = COLUMNS.map((c) => c.label);
    const keys = COLUMNS.map((c) => c.key as string);
    const filename = `daily-sales-${from}-to-${to}.csv`;
    exportToCsv(filename, sortedRows as unknown as Array<Record<string, unknown>>, headers, keys);
  }

  const actions = (
    <>
      <TouchButton variant="ghost" onClick={() => setRefreshTick((n) => n + 1)}>
        Refresh
      </TouchButton>
      <TouchButton variant="gold" onClick={handleDownloadCsv} disabled={sortedRows.length === 0}>
        Download CSV
      </TouchButton>
      <Link
        to="/reports"
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Back to Reports
      </Link>
    </>
  );

  return (
    <JoyPageShell title="Daily Sales" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <p className="ml-auto text-xs text-hawk-600">{rows.length} days returned</p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!loading && chronologicalDays.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
            <SectionHeading level={3} eyebrow="Trend">
              {leftLabel}
            </SectionHeading>
            <div className="mt-3">
              <Sparkline
                points={leftPoints}
                width={400}
                height={64}
                stroke={leftStroke}
                ariaLabel={`${leftLabel} trend over ${chronologicalDays.length} days`}
              />
            </div>
          </section>
          <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
            <SectionHeading level={3} eyebrow="Trend">
              Orders
            </SectionHeading>
            <div className="mt-3">
              <Sparkline
                points={orderPoints}
                width={400}
                height={64}
                stroke="var(--color-hawk-700)"
                ariaLabel={`Orders trend over ${chronologicalDays.length} days`}
              />
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        {loading ? (
          <LoadingSpinner />
        ) : sortedRows.length === 0 ? (
          <BotanicalEmptyState
            title="No daily sales in this range"
            description="Pick a wider date window or wait for orders to start flowing in."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm tabular-nums">
              <thead className="bg-gray-50">
                <tr>
                  {COLUMNS.map((col) => (
                    <SortableHeader
                      key={col.key as string}
                      label={col.label}
                      align={col.align ?? 'left'}
                      active={sortKey === col.key}
                      direction={sortDir}
                      onClick={() => handleSort(col.key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row) => (
                  <tr key={row.date}>
                    <td className="px-3 py-2 text-gray-900">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.orderCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.itemCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.walkUpCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.preorderCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </JoyPageShell>
  );
}

function SortableHeader({
  label,
  align,
  active,
  direction,
  onClick,
}: {
  label: string;
  align: 'left' | 'right';
  active: boolean;
  direction: SortDir;
  onClick: () => void;
}) {
  const arrow = active ? (direction === 'asc' ? '▲' : '▼') : '';
  return (
    <th className={`px-3 py-2 font-semibold text-gray-600 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-gray-900"
        onClick={onClick}
      >
        <span>{label}</span>
        {arrow && <span aria-hidden="true">{arrow}</span>}
      </button>
    </th>
  );
}

function sortRows(rows: DailySalesDay[], key: SortKey, dir: SortDir): DailySalesDay[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av ?? '').localeCompare(String(bv ?? '')) * sign;
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
