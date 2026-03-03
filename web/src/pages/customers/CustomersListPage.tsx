import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import { useRecentItems } from '@/hooks/useRecentItems.js';
import { ordersApi } from '@/api/orders.js';
import type { Customer } from '@/types/customer.js';

export function CustomersListPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { recentItems, addRecent } = useRecentItems('recent-customers');
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = letterFilter ? `${letterFilter}*` : search || undefined;
      const result = await customersApi.list({ page, pageSize, search: searchParam });
      setCustomers(result.items);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, letterFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

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

  async function handleSearchSubmit(value: string) {
    if (!value.trim()) return;
    setError(null);
    try {
      // Scan-to-search: check PickupCode -> OrderNumber -> normal search
      const custResult = await customersApi.list({ search: value, pageSize: 1 });
      if (custResult.items.length === 1 && custResult.items[0].pickupCode === value) {
        navigateToCustomer(custResult.items[0]);
        return;
      }
      const orderResult = await ordersApi.list({ search: value, pageSize: 1 });
      if (orderResult.items.length === 1 && orderResult.items[0].orderNumber === value) {
        navigate(`/orders/${orderResult.items[0].id}`);
        return;
      }
    } catch {
      // Fall through to normal search
    }
  }

  function navigateToCustomer(c: Customer) {
    addRecent(c.id, c.displayName);
    navigate(`/customers/${c.id}`);
  }

  function handleLetterSelect(letter: string | null) {
    setLetterFilter(letter);
    setSearch('');
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
          onClick={() => navigate('/customers/new')}
        >
          New Customer
        </button>
      </div>

      <AzTabs selected={letterFilter} onSelect={handleLetterSelect} />

      <div ref={searchRef}>
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search customers or scan pickup code... (press / to focus)"
        />
      </div>

      {/* Hidden form to capture Enter for scan-to-search */}
      <form className="hidden" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(search); }} />

      {recentItems.length > 0 && !search && !letterFilter && (
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recent Customers</p>
          <div className="flex flex-wrap gap-2">
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-100"
                onClick={() => navigate(`/customers/${item.id}`)}
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
      ) : customers.length === 0 ? (
        <EmptyState title="No customers found" description={search || letterFilter ? 'Try a different search or letter.' : 'Create your first customer to get started.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigateToCustomer(c)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{c.displayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{c.pickupCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email ?? '--'}</td>
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
