import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sellersApi } from '@/api/sellers.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { useRecentItems } from '@/hooks/useRecentItems.js';
import type { Seller } from '@/types/seller.js';

export function SellersListPage() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { recentItems, addRecent } = useRecentItems('recent-sellers');
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = letterFilter ? `${letterFilter}*` : search || undefined;
      const result = await sellersApi.list({ page, pageSize, search: searchParam });
      setSellers(result.items);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sellers');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, letterFilter]);

  useEffect(() => { fetchSellers(); }, [fetchSellers]);

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

  function handleSearchChange(value: string) {
    setSearch(value);
    setLetterFilter(null);
    setPage(1);
  }

  function navigateToSeller(s: Seller) {
    addRecent(s.id, s.displayName);
    navigate(`/sellers/${s.id}`);
  }

  function handleLetterSelect(letter: string | null) {
    setLetterFilter(letter);
    setSearch('');
    setPage(1);
  }

  return (
    <JoyPageShell
      title="Sellers"
      eyebrow="Directory"
      actions={
        <TouchButton variant="primary" onClick={() => navigate('/sellers/new')}>
          New Seller
        </TouchButton>
      }
    >
      <AzTabs selected={letterFilter} onSelect={handleLetterSelect} />

      <div ref={searchRef}>
        <SearchBar value={search} onChange={handleSearchChange} placeholder="Search sellers... (press / to focus)" />
      </div>

      {recentItems.length > 0 && !search && !letterFilter && (
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recent Sellers</p>
          <div className="flex flex-wrap gap-2">
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-100"
                onClick={() => navigate(`/sellers/${item.id}`)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : sellers.length === 0 ? (
        <BotanicalEmptyState title="No sellers found" description={search || letterFilter ? 'Try a different search or letter.' : 'Create your first seller to get started.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sellers.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigateToSeller(s)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{s.displayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.grade ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.teacher ?? '--'}</td>
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
    </JoyPageShell>
  );
}
