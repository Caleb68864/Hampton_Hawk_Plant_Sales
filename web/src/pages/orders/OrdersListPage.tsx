import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { PaginationControls } from '@/components/shared/PaginationControls.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { BulkActionToolbar } from '@/components/orders/BulkActionToolbar.js';
import { BulkResultModal } from '@/components/orders/BulkResultModal.js';
import type { Order, OrderStatus, BulkOperationResult } from '@/types/order.js';

const STATUS_OPTIONS: (OrderStatus | '')[] = ['', 'Open', 'InProgress', 'Complete', 'Cancelled'];

type SortKey = 'orderNumber' | 'customerDisplayName' | 'sellerDisplayName' | 'status' | 'isWalkUp' | 'createdAt';
type SortDir = 'asc' | 'desc';

const SORTABLE_KEYS: ReadonlyArray<SortKey> = ['orderNumber', 'customerDisplayName', 'sellerDisplayName', 'status', 'isWalkUp', 'createdAt'];

function parseSortKey(value: string | null): SortKey {
  return SORTABLE_KEYS.includes(value as SortKey) ? (value as SortKey) : 'createdAt';
}

function parseSortDir(value: string | null): SortDir {
  return value === 'asc' ? 'asc' : 'desc';
}

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy = parseSortKey(searchParams.get('sortBy'));
  const sortDir = parseSortDir(searchParams.get('sortDir'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [walkUpFilter, setWalkUpFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [openPrintCount, setOpenPrintCount] = useState('25');
  const [printingOpen, setPrintingOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkOperationResult | null>(null);
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
        sortBy,
        sortDir,
      });
      setOrders(result.items);
      setTotalPages(result.totalPages);
      setSelectedOrderIds((prev) => prev.filter((orderId) => result.items.some((order) => order.id === orderId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, walkUpFilter, sortBy, sortDir]);

  function handleSortClick(column: SortKey) {
    const next = new URLSearchParams(searchParams);
    if (sortBy === column) {
      next.set('sortBy', column);
      next.set('sortDir', sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sortBy', column);
      next.set('sortDir', 'asc');
    }
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  function handleBulkResult(result: BulkOperationResult) {
    setBulkResult(result);
    setSelectedOrderIds([]);
    fetchOrders();
  }

  const orderNumberById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of orders) map[o.id] = o.orderNumber;
    return map;
  }, [orders]);

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

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((prev) => (prev.includes(orderId)
      ? prev.filter((id) => id !== orderId)
      : [...prev, orderId]));
  }

  function toggleSelectAllCurrentPage() {
    const currentIds = orders.map((o) => o.id);
    const isAllSelected = currentIds.every((id) => selectedOrderIds.includes(id));
    setSelectedOrderIds(isAllSelected ? [] : currentIds);
  }

  function handlePrintSelected() {
    if (selectedOrderIds.length === 0) return;
    window.open(`/print/orders?ids=${selectedOrderIds.join(',')}`, '_blank');
  }

  async function fetchOpenOrderIds(limit: number): Promise<string[]> {
    const statuses: OrderStatus[] = ['Open', 'InProgress'];
    const ids: string[] = [];
    const fetchPageSize = 100;

    for (const status of statuses) {
      let currentPage = 1;
      let total = 1;

      while (currentPage <= total && ids.length < limit) {
        const result = await ordersApi.list({
          page: currentPage,
          pageSize: fetchPageSize,
          status,
        });

        ids.push(...result.items.map((order) => order.id));
        total = result.totalPages;
        currentPage += 1;
      }

      if (ids.length >= limit) {
        break;
      }
    }

    return ids.slice(0, limit);
  }

  async function handlePrintOpenOrders() {
    const parsed = Number(openPrintCount);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 25;

    setPrintingOpen(true);
    setError(null);

    try {
      const ids = await fetchOpenOrderIds(limit);
      if (ids.length === 0) {
        setError('No open orders found to print.');
        return;
      }

      window.open(`/print/orders?ids=${ids.join(',')}`, '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare open orders for printing');
    } finally {
      setPrintingOpen(false);
    }
  }

  const allCurrentPageSelected = orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.id));

  function renderSortHeader(label: string, column: SortKey, alignRight = false) {
    const active = sortBy === column;
    const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return (
      <th
        scope="col"
        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${alignRight ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${active ? 'text-hawk-800' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => handleSortClick(column)}
          aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span>{label}</span>
          <span aria-hidden="true">{arrow}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionHeading level={1} eyebrow="Operations">Orders</SectionHeading>
        <TouchButton variant="primary" onClick={() => navigate('/orders/new')}>
          New Order
        </TouchButton>
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

        <div className="ml-auto flex flex-wrap items-end gap-2 rounded-md border border-gray-200 bg-white p-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedOrderIds.length === 0}
            onClick={handlePrintSelected}
          >
            Print Selected ({selectedOrderIds.length})
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Open order count</label>
            <input
              type="number"
              min={1}
              className="w-28 rounded-md border border-gray-300 px-2 py-2 text-sm"
              value={openPrintCount}
              onChange={(e) => setOpenPrintCount(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="rounded-md bg-hawk-600 px-3 py-2 text-sm font-medium text-white hover:bg-hawk-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={printingOpen}
            onClick={handlePrintOpenOrders}
          >
            {printingOpen ? 'Preparing…' : 'Print Open Orders'}
          </button>

          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedOrderIds.length === 0}
            title="Print 10 barcode labels per selected order"
            onClick={() => window.open(`/print/order-barcodes?ids=${selectedOrderIds.join(',')}`, '_blank')}
          >
            Print Barcodes (Selected)
          </button>

          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Print 10 barcode labels for every open order"
            onClick={() => window.open('/print/order-barcodes?status=Open', '_blank')}
          >
            Print Barcodes (All Open)
          </button>
        </div>
      </div>

      {/* Hidden form for scan-to-search enter */}
      <form className="hidden" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(search); }} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {selectedOrderIds.length > 0 && (
        <BulkActionToolbar
          selectedIds={selectedOrderIds}
          onResult={handleBulkResult}
          onClearSelection={() => setSelectedOrderIds([])}
        />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <BotanicalEmptyState
          title="No orders found"
          description={search || statusFilter ? 'Try different filters or clear your search to see every order.' : 'Create your first order to get started.'}
          action={
            search || statusFilter ? undefined : (
              <TouchButton variant="primary" onClick={() => navigate('/orders/new')}>
                Create your first order
              </TouchButton>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      aria-label="Select all orders on this page"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  {renderSortHeader('Order #', 'orderNumber')}
                  {renderSortHeader('Customer', 'customerDisplayName')}
                  {renderSortHeader('Seller', 'sellerDisplayName')}
                  {renderSortHeader('Status', 'status')}
                  {renderSortHeader('Type', 'isWalkUp')}
                  {renderSortHeader('Date', 'createdAt')}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${o.orderNumber}`}
                        checked={selectedOrderIds.includes(o.id)}
                        onChange={() => toggleOrderSelection(o.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.customerDisplayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.sellerDisplayName ?? '--'}</td>
                    <td className="px-4 py-3 text-sm"><StatusChip status={o.status} hasIssue={o.hasIssue} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.isWalkUp ? 'Walk-Up' : 'Pre-Order'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        title="Print barcode roll for this order"
                        onClick={() => window.open(`/print/order-barcodes/${o.id}?count=10`, '_blank')}
                      >
                        Print barcodes
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

      <BulkResultModal
        isOpen={bulkResult !== null}
        result={bulkResult}
        orderNumberById={orderNumberById}
        onClose={() => setBulkResult(null)}
      />
    </div>
  );
}
