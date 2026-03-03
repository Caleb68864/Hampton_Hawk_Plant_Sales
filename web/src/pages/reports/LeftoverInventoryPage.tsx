import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '@/api/inventory.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import type { InventoryItem } from '@/types/inventory.js';

const PAGE_SIZE = 200;

export function LeftoverInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    inventoryApi
      .list({ page: 1, pageSize: PAGE_SIZE })
      .then((result) => setItems(result.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load inventory report.'))
      .finally(() => setLoading(false));
  }, []);

  const leftoverItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => item.onHandQty > 0)
      .filter((item) => {
        if (!term) return true;
        return item.plantName.toLowerCase().includes(term) || item.plantSku.toLowerCase().includes(term);
      })
      .sort((a, b) => b.onHandQty - a.onHandQty);
  }, [items, search]);

  const totalLeftoverPlants = leftoverItems.length;
  const totalUnitsLeftover = leftoverItems.reduce((sum, item) => sum + item.onHandQty, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leftover Inventory</h1>
          <p className="text-sm text-gray-600">Post-sale report for cash-and-carry planning.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/walkup/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Create Cash & Carry Sale
          </Link>
          <Link
            to="/reports"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Reports
          </Link>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Plants with Leftover Stock" value={totalLeftoverPlants} />
        <MetricCard label="Total Units Leftover" value={totalUnitsLeftover} />
        <MetricCard label="Out of Stock" value={Math.max(items.length - totalLeftoverPlants, 0)} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Available for Cash & Carry</h2>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-80"
            placeholder="Search by plant name or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {leftoverItems.length === 0 ? (
          <p className="text-sm text-gray-500">No leftover inventory found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Plant</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">On Hand</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Stock Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leftoverItems.map((item) => {
                  const barWidth = Math.max(6, Math.min(100, (item.onHandQty / 40) * 100));
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-900">{item.plantName}</td>
                      <td className="px-3 py-2 text-gray-600">{item.plantSku}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{item.onHandQty.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="h-2.5 w-full rounded-full bg-gray-100">
                          <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}
