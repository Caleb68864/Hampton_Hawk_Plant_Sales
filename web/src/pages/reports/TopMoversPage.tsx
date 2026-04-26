import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { TopMoverRow } from '@/types/reports.js';
import { exportToCsv } from '@/utils/csvExport.js';

type SortKey = keyof TopMoverRow;
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'plantName', label: 'Plant Name', align: 'left' },
  { key: 'qtyOrdered', label: 'Qty Ordered', align: 'right' },
  { key: 'qtyFulfilled', label: 'Qty Fulfilled', align: 'right' },
  { key: 'orderCount', label: 'Order Count', align: 'right' },
];

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;
type LimitOption = typeof LIMIT_OPTIONS[number];

export function TopMoversPage() {
  const [limit, setLimit] = useState<LimitOption>(25);
  const [rows, setRows] = useState<TopMoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('qtyOrdered');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getTopMovers(limit)
      .then((result) => setRows(result.plants))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load top movers.'))
      .finally(() => setLoading(false));
  }, [limit, refreshTick]);

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
    const filename = `top-movers-${limit}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <JoyPageShell title="Top Movers" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">Limit</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) as LimitOption)}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </label>
          <p className="ml-auto text-xs text-hawk-600">{rows.length} plants returned</p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        {loading ? (
          <LoadingSpinner />
        ) : sortedRows.length === 0 ? (
          <BotanicalEmptyState
            title="No movers yet"
            description="Once orders include plants, the most-ordered will appear here."
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
                  <tr key={row.plantCatalogId}>
                    <td className="px-3 py-2 text-gray-900">
                      <Link
                        to={`/plants/${row.plantCatalogId}`}
                        className="text-hawk-700 hover:text-hawk-900 hover:underline"
                      >
                        {row.plantName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{row.qtyOrdered.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{row.qtyFulfilled.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.orderCount.toLocaleString()}</td>
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

function sortRows(rows: TopMoverRow[], key: SortKey, dir: SortDir): TopMoverRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av ?? '').localeCompare(String(bv ?? '')) * sign;
  });
}
