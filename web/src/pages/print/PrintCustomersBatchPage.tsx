import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { CustomerPickListSheet } from '@/components/print/CustomerPickListSheet.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { useAsyncData } from '@/hooks/useAsyncData.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import { PRINT_FETCH_CONCURRENCY, settleWithConcurrency } from '@/utils/mapWithConcurrency.js';
import type { Order } from '@/types/order.js';
import type { Customer } from '@/types/customer.js';

interface CustomerBundle {
  customer: Customer;
  orders: Order[];
  /** Orders that belong to this customer but could not be fetched. */
  failedOrderCount: number;
}

interface CustomerBatch {
  bundles: CustomerBundle[];
  /** Customer ids that could not be fetched at all. */
  failedCustomerCount: number;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function loadCustomerBundle(customerId: string): Promise<CustomerBundle> {
  const [customer, orderListResult] = await Promise.all([
    customersApi.getById(customerId),
    ordersApi.list({ customerId, pageSize: 500 }),
  ]);

  // Per-order failures drop that order from the sheet rather than the whole
  // batch; the fan-out is bounded so 500 customers cannot open 500+ sockets.
  const settled = await settleWithConcurrency(
    orderListResult.items,
    PRINT_FETCH_CONCURRENCY,
    (order) => ordersApi.getById(order.id),
  );
  const fullOrders = settled.flatMap((r) => (r.ok ? [r.value] : []));

  return {
    customer,
    orders: fullOrders,
    failedOrderCount: settled.length - fullOrders.length,
  };
}

async function loadCustomerBundles(customerIds: string[]): Promise<CustomerBatch> {
  if (customerIds.length === 0) return { bundles: [], failedCustomerCount: 0 };
  const results = await settleWithConcurrency(customerIds, PRINT_FETCH_CONCURRENCY, (id) => loadCustomerBundle(id));
  const bundles = results.flatMap((r) => (r.ok ? [r.value] : []));
  if (bundles.length === 0) {
    throw new Error('None of the selected customers could be loaded.');
  }
  return { bundles, failedCustomerCount: results.length - bundles.length };
}

export function PrintCustomersBatchPage() {
  const [searchParams] = useSearchParams();
  const customerIds = useMemo(() => parseIds(searchParams.get('ids')), [searchParams]);

  const { data, loading, error } = useAsyncData(
    () => loadCustomerBundles(customerIds),
    customerIds.join(','),
    'Failed to load customers',
  );
  const bundles: CustomerBundle[] = useMemo(() => data?.bundles ?? [], [data]);
  const failedCustomerCount = data?.failedCustomerCount ?? 0;
  const failedOrderCount = bundles.reduce((sum, b) => sum + b.failedOrderCount, 0);

  const [includePreorders, setIncludePreorders] = useState(true);
  const [includeWalkups, setIncludeWalkups] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'qty'>('name');

  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  const filteredBundles = useMemo(() => {
    return bundles.map((bundle) => ({
      ...bundle,
      orders: bundle.orders.filter((o) => {
        if (!includePreorders && !o.isWalkUp) return false;
        if (!includeWalkups && o.isWalkUp) return false;
        if (!includeCompleted && o.status === 'Complete') return false;
        return true;
      }),
    }));
  }, [bundles, includePreorders, includeWalkups, includeCompleted]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (customerIds.length === 0) {
    return <ErrorBanner message="No customers were selected to print." />;
  }

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), '/customers');

  return (
    <PrintLayout backTo={backTo}>
      {(failedCustomerCount > 0 || failedOrderCount > 0) && (
        <p className="no-print mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          {failedCustomerCount > 0 && `${failedCustomerCount} customer${failedCustomerCount === 1 ? '' : 's'} could not be loaded. `}
          {failedOrderCount > 0 && `${failedOrderCount} order${failedOrderCount === 1 ? '' : 's'} could not be loaded. `}
          Those are not included in this print run.
        </p>
      )}
      <div className="no-print mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Print Options</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeWalkups}
              onChange={(e) => setIncludeWalkups(e.target.checked)}
            />
            Include walk-up orders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePreorders}
              onChange={(e) => setIncludePreorders(e.target.checked)}
            />
            Include pre-orders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Include completed orders
          </label>
          <div className="border-l border-gray-300 pl-4">
            <label className="mr-2 text-sm font-medium text-gray-700">Sort plants by:</label>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'qty')}
            >
              <option value="name">Name</option>
              <option value="qty">Qty Needed (desc)</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Printing compact pick lists for {bundles.length} customer{bundles.length === 1 ? '' : 's'}
          {' '}(one sheet per customer).
        </p>
      </div>

      {filteredBundles.map((bundle, idx) => (
        <div
          key={bundle.customer.id}
          className={idx < filteredBundles.length - 1 ? 'page-break' : ''}
        >
          <CustomerPickListSheet
            customer={bundle.customer}
            orders={bundle.orders}
            sortBy={sortBy}
            printedAt={printedAt}
          />
        </div>
      ))}
    </PrintLayout>
  );
}
