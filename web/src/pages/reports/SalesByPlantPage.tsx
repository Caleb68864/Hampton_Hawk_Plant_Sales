import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { SalesByPlantRow } from '@/types/reports.js';
import { exportToCsv } from '@/utils/csvExport.js';

type SortKey = keyof SalesByPlantRow;
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: 'plantName', label: 'Plant', align: 'left' },
  { key: 'plantSku', label: 'SKU', align: 'left' },
  { key: 'orderCount', label: 'Orders', align: 'right' },
  { key: 'itemsOrdered', label: 'Items Ordered', align: 'right' },
  { key: 'itemsFulfilled', label: 'Items Fulfilled', align: 'right' },
  { key: 'revenueOrdered', label: 'Revenue Ordered', align: 'right' },
  { key: 'revenueFulfilled', label: 'Revenue Fulfilled', align: 'right' },
];

export function SalesByPlantPage() {
  const [rows, setRows] = useState<SalesByPlantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('revenueOrdered');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .salesByPlant()
      .then((result) => setRows(result))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load sales by plant report.'))
      .finally(() => setLoading(false));
  }, []);

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
    const filename = `sales-by-plant-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(filename, sortedRows as unknown as Array<Record<string, unknown>>, headers, keys);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading level={3} eyebrow="Sales Breakdown">
          Sales by Plant
        </SectionHeading>
        <div className="flex items-center gap-2">
          <TouchButton variant="gold" onClick={handleDownloadCsv} disabled={sortedRows.length === 0}>
            Download CSV
          </TouchButton>
          <Link
            to="/reports"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Reports
          </Link>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        {sortedRows.length === 0 ? (
          <BotanicalEmptyState
            title="No plant sales yet"
            description="Once orders are placed for plants, totals will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
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
                    <td className="px-3 py-2 text-gray-900">{row.plantName}</td>
                    <td className="px-3 py-2 text-gray-600">{row.plantSku}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.orderCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.itemsOrdered.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.itemsFulfilled.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.revenueOrdered)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(row.revenueFulfilled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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

function sortRows(rows: SalesByPlantRow[], key: SortKey, dir: SortDir): SalesByPlantRow[] {
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
