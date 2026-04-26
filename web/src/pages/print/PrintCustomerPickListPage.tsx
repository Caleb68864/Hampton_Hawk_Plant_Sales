import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import type { Order } from '@/types/order.js';
import type { Customer } from '@/types/customer.js';

interface AggregatedRow {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  notes: string[];
}

function aggregateLines(orders: Order[]): AggregatedRow[] {
  const byPlant = new Map<string, AggregatedRow>();

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      const existing = byPlant.get(line.plantCatalogId);
      if (existing) {
        existing.qtyOrdered += line.qtyOrdered;
        existing.qtyFulfilled += line.qtyFulfilled;
        if (line.notes && !existing.notes.includes(line.notes)) {
          existing.notes.push(line.notes);
        }
      } else {
        byPlant.set(line.plantCatalogId, {
          plantCatalogId: line.plantCatalogId,
          plantName: line.plantName,
          plantSku: line.plantSku,
          qtyOrdered: line.qtyOrdered,
          qtyFulfilled: line.qtyFulfilled,
          notes: line.notes ? [line.notes] : [],
        });
      }
    });
  });

  return [...byPlant.values()];
}

export function PrintCustomerPickListPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [searchParams] = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [includePreorders, setIncludePreorders] = useState(true);
  const [includeWalkups, setIncludeWalkups] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<'plant' | 'order'>('plant');

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerPickList() {
      setLoading(true);
      setError(null);

      try {
        const [customerRecord, orderListResult] = await Promise.all([
          customersApi.getById(customerId!),
          ordersApi.list({ customerId: customerId!, pageSize: 500 }),
        ]);

        const fullOrders = await Promise.all(
          orderListResult.items.map((order) => ordersApi.getById(order.id)),
        );

        if (cancelled) {
          return;
        }

        setCustomer(customerRecord);
        setOrders(fullOrders);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load customer data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCustomerPickList();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!includePreorders && !o.isWalkUp) return false;
      if (!includeWalkups && o.isWalkUp) return false;
      if (!includeCompleted && o.status === 'Complete') return false;
      return true;
    });
  }, [orders, includePreorders, includeWalkups, includeCompleted]);

  const aggregatedRows = useMemo(() => {
    const rows = aggregateLines(filteredOrders);
    rows.sort((a, b) => a.plantName.localeCompare(b.plantName));
    return rows;
  }, [filteredOrders]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    if (sortBy === 'order') {
      sorted.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    } else {
      // 'plant' sort: keep order arrival order (createdAt asc)
      sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }
    return sorted;
  }, [filteredOrders, sortBy]);

  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  if (loading) return <LoadingSpinner />;
  if (error || !customer) return <ErrorBanner message={error ?? 'Customer not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/customers/${customer.id}`);
  const totalOrdered = aggregatedRows.reduce((sum, r) => sum + r.qtyOrdered, 0);
  const totalFulfilled = aggregatedRows.reduce((sum, r) => sum + r.qtyFulfilled, 0);

  return (
    <PrintLayout backTo={backTo}>
      <div className="no-print mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Print Options</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePreorders}
              onChange={(e) => setIncludePreorders(e.target.checked)}
            />
            Include Pre-Orders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeWalkups}
              onChange={(e) => setIncludeWalkups(e.target.checked)}
            />
            Include Walk-Ups
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Include Completed
          </label>
          <div className="border-l border-gray-300 pl-4">
            <label className="mr-2 text-sm font-medium text-gray-700">Sort orders by:</label>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'plant' | 'order')}
            >
              <option value="plant">Order Date</option>
              <option value="order">Order Number</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Showing {filteredOrders.length} of {orders.length} orders for {customer.displayName}
        </p>
      </div>

      <PrintHeader
        subtitle={`Customer Pick List - ${customer.displayName}`}
        customerName={customer.displayName}
        pickupCode={customer.pickupCode}
        timestamp={printedAt}
      />

      {customer.picklistBarcode ? (
        <div
          className="mb-4 flex flex-col items-center"
          data-picklist-barcode={customer.picklistBarcode}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            Scan to pull all orders
          </p>
          <OrderNumberBarcode value={customer.picklistBarcode} variant="bare" />
        </div>
      ) : (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          No pick-list barcode -- admin must regenerate via Customers page.
        </div>
      )}

      <h2 className="mt-6 mb-3 text-xl font-bold text-center">Pick List</h2>

      {filteredOrders.length === 0 ? (
        <p className="py-12 text-center text-gray-500">No orders to pick for this customer.</p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="w-8 py-2 px-1 text-left"></th>
                <th className="py-2 px-2 text-left">Plant Name</th>
                <th className="py-2 px-2 text-left">SKU</th>
                <th className="py-2 px-2 text-right">Qty Ordered</th>
                <th className="py-2 px-2 text-right">Qty Fulfilled</th>
                <th className="py-2 px-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedRows.map((row) => (
                <tr key={row.plantCatalogId} className="border-b border-gray-300">
                  <td className="py-2 px-1">
                    <span className="print-checkbox" />
                  </td>
                  <td className="py-2 px-2">{row.plantName}</td>
                  <td className="py-2 px-2 font-mono text-xs">{row.plantSku}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.qtyOrdered}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.qtyFulfilled}</td>
                  <td className="py-2 px-2 text-xs text-gray-600">{row.notes.join('; ')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-2 px-1"></td>
                <td className="py-2 px-2" colSpan={2}>Total</td>
                <td className="py-2 px-2 text-right tabular-nums">{totalOrdered}</td>
                <td className="py-2 px-2 text-right tabular-nums">{totalFulfilled}</td>
                <td className="py-2 px-2"></td>
              </tr>
            </tfoot>
          </table>

          <section className="mt-8">
            <h3 className="mb-3 text-lg font-semibold">Per-Order Breakdown</h3>
            <div className="space-y-6">
              {sortedOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-md border border-gray-300 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
                    <div>
                      <span className="font-semibold">Order #:</span>{' '}
                      <span className="font-mono">{order.orderNumber}</span>
                      <span className="ml-3 text-xs uppercase tracking-wide text-gray-500">
                        {order.status}
                      </span>
                      {order.isWalkUp && (
                        <span className="ml-2 rounded bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-900">
                          Walk-Up
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="mb-3">
                    <OrderNumberBarcode value={order.orderNumber} variant="bare" />
                  </div>

                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-400">
                        <th className="py-1 px-2 text-left">Plant</th>
                        <th className="py-1 px-2 text-left">SKU</th>
                        <th className="py-1 px-2 text-right">Ordered</th>
                        <th className="py-1 px-2 text-right">Fulfilled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => (
                        <tr key={line.id} className="border-b border-gray-200">
                          <td className="py-1 px-2">{line.plantName}</td>
                          <td className="py-1 px-2 font-mono text-xs">{line.plantSku}</td>
                          <td className="py-1 px-2 text-right tabular-nums">{line.qtyOrdered}</td>
                          <td className="py-1 px-2 text-right tabular-nums">{line.qtyFulfilled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {customer.picklistBarcode && (
            <section className="page-break-before mt-8 border-t-2 border-gray-300 pt-6">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Customer Pick List Barcode
                </p>
                <div
                  className="mx-auto mt-3 max-w-[320px]"
                  data-picklist-barcode={customer.picklistBarcode}
                >
                  <OrderNumberBarcode value={customer.picklistBarcode} variant="bare" />
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  {customer.displayName} -- Pickup Code{' '}
                  <span className="font-mono font-semibold">{customer.pickupCode}</span>
                </p>
              </div>
            </section>
          )}
        </>
      )}

      <PrintFooter />
    </PrintLayout>
  );
}
