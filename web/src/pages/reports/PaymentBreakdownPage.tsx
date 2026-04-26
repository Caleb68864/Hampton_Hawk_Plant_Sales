import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { Donut } from '@/components/reports/Donut.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { PaymentBreakdownRow } from '@/types/reports.js';
import { exportToCsv } from '@/utils/csvExport.js';

// Six-color palette pulled from the existing hawk/gold ranges so the donut
// stays inside the brand without introducing new tokens.
const PALETTE = [
  '#7a3d93', // hawk-700
  '#d4a021', // gold-600
  '#9b66b3', // hawk-500
  '#e6b94a', // gold-500
  '#5a2d6f', // hawk-800
  '#b88a1a', // gold-700
];

type SortKey = keyof PaymentBreakdownRow;
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'method', label: 'Method', align: 'left' },
  { key: 'orderCount', label: 'Orders', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'averageOrder', label: 'Avg Order', align: 'right' },
];

export function PaymentBreakdownPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<PaymentBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getPaymentBreakdown(from || undefined, to || undefined)
      .then((result) => setRows(result.methods))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load payment breakdown.'))
      .finally(() => setLoading(false));
  }, [from, to, refreshTick]);

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  const allRevenueZero = useMemo(() => rows.every((r) => r.revenue === 0), [rows]);
  const donutMode: 'revenue' | 'orders' = allRevenueZero ? 'orders' : 'revenue';
  const donutTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (donutMode === 'revenue' ? r.revenue : r.orderCount), 0);
  }, [rows, donutMode]);

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
    const filename = `payment-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <JoyPageShell title="Payment Breakdown" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <p className="ml-auto text-xs text-hawk-600">
            {from || to ? 'Filtered range' : 'All time'} • {rows.length} methods
          </p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!loading && rows.length > 0 && (
        <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
          <SectionHeading level={3} eyebrow="Distribution">
            Revenue by Method
          </SectionHeading>
          <div className="mt-4 flex justify-center">
            <Donut
              segments={rows.map((m, i) => ({
                label: m.method,
                value: donutMode === 'revenue' ? m.revenue : m.orderCount,
                color: PALETTE[i % PALETTE.length] as string,
              }))}
              centerLabel={donutMode === 'revenue' ? 'Total' : 'Orders'}
              centerValue={
                donutMode === 'revenue'
                  ? formatCurrency(donutTotal)
                  : donutTotal.toLocaleString()
              }
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        {loading ? (
          <LoadingSpinner />
        ) : sortedRows.length === 0 ? (
          <BotanicalEmptyState
            title="No payments yet"
            description="Once orders capture payment methods, you'll see them grouped here."
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
                  <tr key={row.method}>
                    <td className="px-3 py-2 text-gray-900">{row.method}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.orderCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(row.averageOrder)}</td>
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

function sortRows(rows: PaymentBreakdownRow[], key: SortKey, dir: SortDir): PaymentBreakdownRow[] {
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
