import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import type { Order, OrderStatus } from '@/types/order.js';

const STATUS_OPTIONS: (OrderStatus | '')[] = ['', 'Open', 'InProgress', 'Complete', 'Cancelled'];

export function OrdersListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [walkUpFilter, setWalkUpFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ordersApi.list({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        isWalkUp: walkUpFilter === 'true' ? true : walkUpFilter === 'false' ? false : undefined,
      });
      setOrders(result.items);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, walkUpFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

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

  async function handleSearchSubmit(value: string) {
    if (!value.trim()) return;
    try {
      // Scan-to-search: PickupCode -> OrderNumber -> normal search
      const custResult = await customersApi.list({ search: value, pageSize: 1 });
      if (custResult.items.length === 1 && custResult.items[0].pickupCode === value) {
        navigate(`/customers/${custResult.items[0].id}`);
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

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
          onClick={() => navigate('/orders/new')}
        >
          New Order
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]" ref={searchRef}>
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search orders, customers, pickup codes... (press / to focus)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Walk-Up</label>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={walkUpFilter}
            onChange={(e) => { setWalkUpFilter(e.target.value); setPage(1); }}
          >
            <option value="">All</option>
            <option value="true">Walk-Up Only</option>
            <option value="false">Pre-Order Only</option>
          </select>
        </div>
      </div>

      {/* Hidden form for scan-to-search enter */}
      <form className="hidden" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(search); }} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders found" description={search || statusFilter ? 'Try different filters.' : 'Create your first order to get started.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.customerDisplayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.sellerDisplayName ?? '--'}</td>
                    <td className="px-4 py-3 text-sm"><StatusChip status={o.status} hasIssue={o.hasIssue} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.isWalkUp ? 'Walk-Up' : 'Pre-Order'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
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
