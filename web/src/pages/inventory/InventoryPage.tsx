import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryApi } from '@/api/inventory.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import type { InventoryItem } from '@/types/inventory.js';

const LOW_STOCK_THRESHOLD = 5;

interface AdjustModalState {
  item: InventoryItem | null;
  deltaQty: string;
  reason: string;
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');
  const [adjustModal, setAdjustModal] = useState<AdjustModalState>({ item: null, deltaQty: '', reason: '' });
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryApi.list({ page, pageSize, search: search || undefined });
      setItems(result.items);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditQty(String(item.onHandQty));
    setEditReason('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQty('');
    setEditReason('');
  }

  async function saveEdit(item: InventoryItem) {
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) return;
    setError(null);
    try {
      await inventoryApi.update(item.plantCatalogId, { onHandQty: qty, reason: editReason || undefined });
      cancelEdit();
      await fetchInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update inventory');
    }
  }

  async function submitAdjust() {
    if (!adjustModal.item) return;
    const delta = parseInt(adjustModal.deltaQty, 10);
    if (isNaN(delta) || delta === 0 || !adjustModal.reason.trim()) return;
    setError(null);
    try {
      await inventoryApi.adjust({
        plantCatalogId: adjustModal.item.plantCatalogId,
        deltaQty: delta,
        reason: adjustModal.reason.trim(),
      });
      setAdjustModal({ item: null, deltaQty: '', reason: '' });
      await fetchInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust inventory');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
      </div>

      <div ref={searchRef}>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search inventory by plant name or SKU... (press / to focus)" />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No inventory found" description={search ? 'Try a different search term.' : 'Inventory will appear here once plants are imported.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plant Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">On Hand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.plantName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.plantSku}</td>
                    <td className="px-4 py-3 text-sm">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Reason"
                            className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                          />
                          <button
                            type="button"
                            className="text-hawk-600 hover:text-hawk-700 text-sm font-medium"
                            onClick={() => saveEdit(item)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700 text-sm"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className={item.onHandQty < LOW_STOCK_THRESHOLD ? 'font-semibold text-red-600' : 'text-gray-900'}>
                            {item.onHandQty}
                          </span>
                          {item.onHandQty < LOW_STOCK_THRESHOLD && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Low Stock
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      {editingId !== item.id && (
                        <>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                            onClick={() => setAdjustModal({ item, deltaQty: '', reason: '' })}
                          >
                            Adjust
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </>
      )}

      {adjustModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAdjustModal({ item: null, deltaQty: '', reason: '' })}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Adjust Inventory</h2>
            <p className="mt-1 text-sm text-gray-600">{adjustModal.item.plantName} (Current: {adjustModal.item.onHandQty})</p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="adjust-delta" className="block text-sm font-medium text-gray-700">Quantity Change (+/-)</label>
                <input
                  id="adjust-delta"
                  type="number"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                  value={adjustModal.deltaQty}
                  onChange={(e) => setAdjustModal((prev) => ({ ...prev, deltaQty: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="adjust-reason" className="block text-sm font-medium text-gray-700">Reason *</label>
                <input
                  id="adjust-reason"
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                onClick={() => setAdjustModal({ item: null, deltaQty: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
                disabled={!adjustModal.deltaQty || !adjustModal.reason.trim()}
                onClick={submitAdjust}
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
