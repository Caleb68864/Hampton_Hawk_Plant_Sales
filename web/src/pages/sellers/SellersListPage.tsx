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
import {
  buildPrintSellerPacketPath,
  buildPrintSellersBatchPath,
} from '@/utils/printRoutes.js';
import { openPrintWindow } from '@/utils/printWindow.js';
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
  const [selectedSellerIds, setSelectedSellerIds] = useState<Set<string>>(new Set());
  const [printingAll, setPrintingAll] = useState(false);
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
      // Drop selections that are no longer visible on this page
      setSelectedSellerIds((prev) => {
        const next = new Set<string>();
        for (const s of result.items) {
          if (prev.has(s.id)) next.add(s.id);
        }
        return next;
      });
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

  function toggleSellerSelection(sellerId: string) {
    setSelectedSellerIds((prev) => {
      const next = new Set(prev);
      if (next.has(sellerId)) {
        next.delete(sellerId);
      } else {
        next.add(sellerId);
      }
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedSellerIds((prev) => {
      const allSelected = sellers.length > 0 && sellers.every((s) => prev.has(s.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const s of sellers) next.delete(s.id);
        return next;
      }
      const next = new Set(prev);
      for (const s of sellers) next.add(s.id);
      return next;
    });
  }

  function handlePrintSelected() {
    if (selectedSellerIds.size === 0) return;
    if (
      !openPrintWindow(buildPrintSellersBatchPath(Array.from(selectedSellerIds), '/sellers'))
    ) {
      setError('Allow pop-ups for this site so the print preview can open.');
    }
  }

  async function handlePrintAll() {
    setPrintingAll(true);
    setError(null);
    try {
      // Pull a generous page; sellers lists are small in practice.
      const result = await sellersApi.list({ page: 1, pageSize: 500 });
      const ids = result.items.map((s) => s.id);
      if (ids.length === 0) {
        setError('No sellers found to print.');
        return;
      }
      if (!openPrintWindow(buildPrintSellersBatchPath(ids, '/sellers'))) {
        setError('Allow pop-ups for this site so the print preview can open.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sellers for printing');
    } finally {
      setPrintingAll(false);
    }
  }

  const allOnPageSelected =
    sellers.length > 0 && sellers.every((s) => selectedSellerIds.has(s.id));

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

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
        <TouchButton
          variant="gold"
          disabled={selectedSellerIds.size === 0}
          onClick={handlePrintSelected}
        >
          Print Selected Pick Lists ({selectedSellerIds.size})
        </TouchButton>
        <TouchButton
          variant="ghost"
          disabled={printingAll}
          onClick={handlePrintAll}
        >
          {printingAll ? 'Preparing...' : 'Print All Pick Lists'}
        </TouchButton>
        <p className="text-xs text-gray-500">
          One compact sheet per seller; respects current selection.
        </p>
      </div>

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      aria-label="Select all sellers on this page"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sellers.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigateToSeller(s)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select seller ${s.displayName}`}
                        checked={selectedSellerIds.has(s.id)}
                        onChange={() => toggleSellerSelection(s.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{s.displayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.grade ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.teacher ?? '--'}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          if (!openPrintWindow(buildPrintSellerPacketPath(s.id, '/sellers'))) {
                            setError('Allow pop-ups for this site so the print preview can open.');
                          }
                        }}
                      >
                        Print
                      </button>
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
    </JoyPageShell>
  );
}
