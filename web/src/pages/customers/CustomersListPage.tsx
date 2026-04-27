import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { useRecentItems } from '@/hooks/useRecentItems.js';
import { ordersApi } from '@/api/orders.js';
import {
  buildPrintCustomerPickListPath,
  buildPrintCustomersBatchPath,
} from '@/utils/printRoutes.js';
import { openPrintWindow } from '@/utils/printWindow.js';
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
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [printingAll, setPrintingAll] = useState(false);
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
      // Drop selections that are no longer visible on this page
      setSelectedCustomerIds((prev) => {
        const next = new Set<string>();
        for (const c of result.items) {
          if (prev.has(c.id)) next.add(c.id);
        }
        return next;
      });
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

  function toggleCustomerSelection(customerId: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedCustomerIds((prev) => {
      const allSelected = customers.length > 0 && customers.every((c) => prev.has(c.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const c of customers) next.delete(c.id);
        return next;
      }
      const next = new Set(prev);
      for (const c of customers) next.add(c.id);
      return next;
    });
  }

  function handlePrintSelected() {
    if (selectedCustomerIds.size === 0) return;
    if (
      !openPrintWindow(buildPrintCustomersBatchPath(Array.from(selectedCustomerIds), '/customers'))
    ) {
      setError('Allow pop-ups for this site so the print preview can open.');
    }
  }

  async function handlePrintAll() {
    setPrintingAll(true);
    setError(null);
    try {
      const result = await customersApi.list({ page: 1, pageSize: 500 });
      const ids = result.items.map((c) => c.id);
      if (ids.length === 0) {
        setError('No customers found to print.');
        return;
      }
      if (!openPrintWindow(buildPrintCustomersBatchPath(ids, '/customers'))) {
        setError('Allow pop-ups for this site so the print preview can open.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers for printing');
    } finally {
      setPrintingAll(false);
    }
  }

  const allOnPageSelected =
    customers.length > 0 && customers.every((c) => selectedCustomerIds.has(c.id));

  return (
    <JoyPageShell
      title="Customers"
      eyebrow="Directory"
      actions={
        <TouchButton variant="primary" onClick={() => navigate('/customers/new')}>
          New Customer
        </TouchButton>
      }
    >
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

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
        <TouchButton
          variant="gold"
          disabled={selectedCustomerIds.size === 0}
          onClick={handlePrintSelected}
        >
          Print Selected Pick Lists ({selectedCustomerIds.size})
        </TouchButton>
        <TouchButton
          variant="ghost"
          disabled={printingAll}
          onClick={handlePrintAll}
        >
          {printingAll ? 'Preparing...' : 'Print All Pick Lists'}
        </TouchButton>
        <p className="text-xs text-gray-500">
          One compact sheet per customer; respects current selection.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : customers.length === 0 ? (
        <BotanicalEmptyState title="No customers found" description={search || letterFilter ? 'Try a different search or letter.' : 'Create your first customer to get started.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      aria-label="Select all customers on this page"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigateToCustomer(c)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select customer ${c.displayName}`}
                        checked={selectedCustomerIds.has(c.id)}
                        onChange={() => toggleCustomerSelection(c.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{c.displayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{c.pickupCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email ?? '--'}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          if (!openPrintWindow(buildPrintCustomerPickListPath(c.id, '/customers'))) {
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
