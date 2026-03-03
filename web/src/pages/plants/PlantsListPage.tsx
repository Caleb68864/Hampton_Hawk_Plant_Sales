import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { plantsApi } from '@/api/plants.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import type { Plant } from '@/types/plant.js';

export function PlantsListPage() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await plantsApi.list({ page, pageSize, search: search || undefined });
      setPlants(result.items);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plants');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchPlants(); }, [fetchPlants]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Plants</h1>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
          onClick={() => navigate('/plants/new')}
        >
          New Plant
        </button>
      </div>

      <div ref={searchRef as React.RefObject<HTMLDivElement>}>
        <SearchBar value={search} onChange={handleSearchChange} placeholder="Search plants by name, SKU, or barcode... (press / to focus)" />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : plants.length === 0 ? (
        <EmptyState title="No plants found" description={search ? 'Try a different search term.' : 'Create your first plant to get started.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {plants.map((plant) => (
                  <tr
                    key={plant.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/plants/${plant.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{plant.name}{plant.variant ? ` (${plant.variant})` : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{plant.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{plant.barcode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{plant.price != null ? `$${plant.price.toFixed(2)}` : '--'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${plant.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {plant.isActive ? 'Active' : 'Inactive'}
                      </span>
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
    </div>
  );
}
