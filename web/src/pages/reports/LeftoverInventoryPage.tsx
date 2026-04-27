import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inventoryApi } from '@/api/inventory.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import type { InventoryItem } from '@/types/inventory.js';

const PAGE_SIZE = 200;

interface WalkUpPrefillLine {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
}

export function LeftoverInventoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPlantIds, setSelectedPlantIds] = useState<Set<string>>(new Set());

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
  const allVisibleSelected = leftoverItems.length > 0 && leftoverItems.every((item) => selectedPlantIds.has(item.plantCatalogId));

  const selectedCount = selectedPlantIds.size;

  function togglePlantSelection(plantCatalogId: string, checked: boolean) {
    setSelectedPlantIds((current) => {
      const next = new Set(current);
      if (checked) next.add(plantCatalogId);
      else next.delete(plantCatalogId);
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedPlantIds((current) => {
      const next = new Set(current);
      for (const item of leftoverItems) {
        if (checked) next.add(item.plantCatalogId);
        else next.delete(item.plantCatalogId);
      }
      return next;
    });
  }

  function handleCreateWalkUpFromSelected() {
    const selectedItems: WalkUpPrefillLine[] = items
      .filter((item) => item.onHandQty > 0 && selectedPlantIds.has(item.plantCatalogId))
      .map((item) => ({
        plantCatalogId: item.plantCatalogId,
        plantName: item.plantName,
        plantSku: item.plantSku,
        qtyOrdered: 1,
      }));

    if (selectedItems.length === 0) return;

    const serialized = encodeURIComponent(JSON.stringify(selectedItems));
    navigate(`/walkup/new?prefill=${serialized}`, {
      state: { preselectedItems: selectedItems },
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <JoyPageShell
      title="Leftover Inventory"
      eyebrow="Post-Sale Report"
      actions={
        <>
          <TouchButton
            variant="primary"
            disabled={selectedCount === 0}
            onClick={handleCreateWalkUpFromSelected}
          >
            Create Walk-Up from Selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </TouchButton>
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
        </>
      }
    >
      <p className="text-sm text-gray-600">Post-sale report for cash-and-carry planning.</p>

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
          <BotanicalEmptyState
            title="No leftover inventory found"
            description={search ? 'Try a different search term.' : 'Once sales close, plants with remaining stock will appear here.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all visible leftover inventory rows"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                    />
                  </th>
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
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.plantName}`}
                          checked={selectedPlantIds.has(item.plantCatalogId)}
                          onChange={(e) => togglePlantSelection(item.plantCatalogId, e.target.checked)}
                        />
                      </td>
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
    </JoyPageShell>
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
