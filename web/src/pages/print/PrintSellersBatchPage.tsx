import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { sellersApi } from '@/api/sellers.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { SellerPickListSheet } from '@/components/print/SellerPickListSheet.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import type { Order } from '@/types/order.js';
import type { Seller } from '@/types/seller.js';
import type { Customer } from '@/types/customer.js';

interface SellerBundle {
  seller: Seller;
  orders: Order[];
  customers: Map<string, Customer>;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function loadSellerBundle(sellerId: string): Promise<SellerBundle> {
  const [seller, orderListResult] = await Promise.all([
    sellersApi.getById(sellerId),
    ordersApi.list({ sellerId, pageSize: 500 }),
  ]);

  const fullOrders = await Promise.all(
    orderListResult.items.map((order) => ordersApi.getById(order.id)),
  );

  const uniqueCustomerIds = [...new Set(fullOrders.map((order) => order.customerId))];
  const customerEntries = await Promise.all(
    uniqueCustomerIds.map(async (id) => [id, await customersApi.getById(id)] as const),
  );

  return {
    seller,
    orders: fullOrders,
    customers: new Map(customerEntries),
  };
}

export function PrintSellersBatchPage() {
  const [searchParams] = useSearchParams();
  const sellerIds = useMemo(() => parseIds(searchParams.get('ids')), [searchParams]);

  const [bundles, setBundles] = useState<SellerBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [includePreorders, setIncludePreorders] = useState(true);
  const [includeWalkups, setIncludeWalkups] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'qty'>('name');

  useEffect(() => {
    if (sellerIds.length === 0) {
      setBundles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(sellerIds.map((id) => loadSellerBundle(id)))
      .then((results) => {
        if (cancelled) return;
        const byId = new Map(results.map((bundle) => [bundle.seller.id, bundle]));
        setBundles(
          sellerIds
            .map((id) => byId.get(id))
            .filter((bundle): bundle is SellerBundle => Boolean(bundle)),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load sellers');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerIds]);

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
  if (sellerIds.length === 0) {
    return <ErrorBanner message="No sellers were selected to print." />;
  }

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), '/sellers');

  return (
    <PrintLayout backTo={backTo}>
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
          Printing compact pick lists for {bundles.length} seller{bundles.length === 1 ? '' : 's'}
          {' '}(one sheet per seller).
        </p>
      </div>

      {filteredBundles.map((bundle, idx) => (
        <div
          key={bundle.seller.id}
          className={idx < filteredBundles.length - 1 ? 'page-break' : ''}
        >
          <SellerPickListSheet
            seller={bundle.seller}
            orders={bundle.orders}
            customers={bundle.customers}
            sortBy={sortBy}
            printedAt={printedAt}
          />
        </div>
      ))}
    </PrintLayout>
  );
}
