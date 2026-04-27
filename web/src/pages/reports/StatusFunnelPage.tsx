import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { StackedBar } from '@/components/reports/StackedBar.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { StatusFunnelBucket } from '@/types/reports.js';
import { exportToCsv } from '@/utils/csvExport.js';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-hawk-500',
  InProgress: 'bg-gold-500',
  Complete: 'bg-green-500',
  Cancelled: 'bg-red-500',
};

type SortKey = keyof StatusFunnelBucket;
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'status', label: 'Status', align: 'left' },
  { key: 'count', label: 'Count', align: 'right' },
  { key: 'percent', label: 'Percent', align: 'right' },
];

export function StatusFunnelPage() {
  const [rows, setRows] = useState<StatusFunnelBucket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getStatusFunnel()
      .then((result) => {
        setRows(result.buckets);
        setTotal(result.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load status funnel.'))
      .finally(() => setLoading(false));
  }, [refreshTick]);

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

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
    const filename = `status-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <JoyPageShell title="Order Status Funnel" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <p className="text-sm text-hawk-700">
          Counts {total.toLocaleString()} non-draft orders across {rows.length} statuses.
        </p>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!loading && rows.length > 0 && (
        <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
          <SectionHeading level={3} eyebrow="Distribution">
            Order Status
          </SectionHeading>
          <div className="mt-4">
            <StackedBar
              segments={rows.map((b) => ({
                label: formatStatus(b.status),
                value: b.count,
                color: STATUS_COLORS[b.status] || 'bg-hawk-400',
              }))}
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        {loading ? (
          <LoadingSpinner />
        ) : sortedRows.length === 0 ? (
          <BotanicalEmptyState
            title="No order statuses yet"
            description="Status counts appear once orders are created."
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
                  <tr key={row.status}>
                    <td className="px-3 py-2 text-gray-900">{formatStatus(row.status)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{row.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatPercent(row.percent)}</td>
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

function sortRows(rows: StatusFunnelBucket[], key: SortKey, dir: SortDir): StatusFunnelBucket[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av ?? '').localeCompare(String(bv ?? '')) * sign;
  });
}

function formatStatus(status: string): string {
  if (!status) return 'Unknown';
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
