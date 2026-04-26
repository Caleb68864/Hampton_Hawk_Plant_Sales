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
  const [includePerOrderDetail, setIncludePerOrderDetail] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'qty'>('name');

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
    if (sortBy === 'qty') {
      rows.sort((a, b) => b.qtyOrdered - a.qtyOrdered);
    } else {
      rows.sort((a, b) => a.plantName.localeCompare(b.plantName));
    }
    return rows;
  }, [filteredOrders, sortBy]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return sorted;
  }, [filteredOrders]);

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
          <label className="flex items-center gap-2 text-sm font-medium text-hawk-900">
            <input
              type="checkbox"
              checked={includePerOrderDetail}
              onChange={(e) => setIncludePerOrderDetail(e.target.checked)}
            />
            Include per-order detail sheets
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Include completed orders
          </label>
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
          Showing {filteredOrders.length} of {orders.length} orders for {customer.displayName}.
          {' '}Default layout is one or two sheets; turn on per-order detail to add follow-on sheets.
        </p>
      </div>

      {/* Sheet 1 -- always rendered: single barcode + aggregated plant needs */}
      <section>
        <PrintHeader
          subtitle="Customer Pick List"
          customerName={customer.displayName}
          pickupCode={customer.pickupCode}
          timestamp={printedAt}
        />

        {customer.picklistBarcode ? (
          <div
            className="mb-4 flex flex-col items-center"
            data-picklist-barcode={customer.picklistBarcode}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
              SCAN TO PULL ALL ORDERS
            </p>
            <OrderNumberBarcode value={customer.picklistBarcode} variant="bare" />
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            No pick-list barcode -- admin must regenerate via Customers page.
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-b border-gray-300 py-2 text-sm">
          <span className="font-semibold">{customer.displayName}</span>
          <span className="text-gray-400">&bull;</span>
          <span>
            Pickup code: <span className="font-mono font-semibold">{customer.pickupCode}</span>
          </span>
          <span className="text-gray-400">&bull;</span>
          <span>{filteredOrders.length} orders</span>
          <span className="text-gray-400">&bull;</span>
          <span>{totalOrdered} total plants</span>
          <span className="text-gray-400">&bull;</span>
          <span>Date: {printedAt}</span>
        </div>

        <h2 className="mt-4 mb-2 text-lg font-bold">Plants to Pick</h2>

        {filteredOrders.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No orders to pick for this customer.</p>
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="w-8 py-2 px-1 text-left"></th>
                  <th className="py-2 px-2 text-left">Plant Name</th>
                  <th className="py-2 px-2 text-left">SKU</th>
                  <th className="py-2 px-2 text-right">Qty Needed</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedRows.map((row) => (
                  <tr key={row.plantCatalogId} className="border-b border-gray-300">
                    <td className="py-1.5 px-1">
                      <span className="print-checkbox" />
                    </td>
                    <td className="py-1.5 px-2">{row.plantName}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{row.plantSku}</td>
                    <td className="py-1.5 px-2 text-right font-semibold tabular-nums">
                      {row.qtyOrdered}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-semibold">
                  <td className="py-2 px-1"></td>
                  <td className="py-2 px-2" colSpan={2}>Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{totalOrdered}</td>
                </tr>
                {totalFulfilled > 0 && (
                  <tr className="text-xs text-gray-500">
                    <td className="px-1"></td>
                    <td className="px-2" colSpan={2}>Already fulfilled</td>
                    <td className="px-2 text-right tabular-nums">{totalFulfilled}</td>
                  </tr>
                )}
              </tfoot>
            </table>

            {sortedOrders.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Orders in this pickup ({sortedOrders.length})
                </h3>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {sortedOrders.map((order) => {
                    const qty = order.lines.reduce((s, l) => s + l.qtyOrdered, 0);
                    const dateLabel = new Date(order.createdAt).toLocaleDateString();
                    return (
                      <li key={order.id} className="flex justify-between border-b border-gray-200 py-1">
                        <span>
                          <span className="font-mono">#{order.orderNumber}</span>
                          <span className="ml-1 text-gray-500">
                            ({order.status}, {dateLabel})
                          </span>
                          {order.isWalkUp && (
                            <span className="ml-1 rounded bg-gold-100 px-1 text-[10px] font-semibold text-gold-900">
                              Walk-Up
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-gray-700">{qty} plants</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </section>

      {/* Sheet 2+ -- opt-in per-order detail sheets. NO customer picklist barcode here. */}
      {includePerOrderDetail &&
        sortedOrders.map((order) => (
          <div key={order.id} className="page-break">
            <PrintHeader
              subtitle={`Order Detail - ${customer.displayName}`}
              customerName={customer.displayName}
              orderNumber={order.orderNumber}
              pickupCode={customer.pickupCode}
              timestamp={new Date(order.createdAt).toLocaleString()}
            />

            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2 text-sm">
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

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="w-8 py-2 px-1 text-left"></th>
                  <th className="py-2 px-2 text-left">Plant Name</th>
                  <th className="py-2 px-2 text-left">SKU</th>
                  <th className="py-2 px-2 text-right">Ordered</th>
                  <th className="py-2 px-2 text-right">Fulfilled</th>
                  <th className="py-2 px-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-300">
                    <td className="py-2 px-1">
                      <span className="print-checkbox" />
                    </td>
                    <td className="py-2 px-2">{line.plantName}</td>
                    <td className="py-2 px-2 font-mono text-xs">{line.plantSku}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{line.qtyOrdered}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{line.qtyFulfilled}</td>
                    <td className="py-2 px-2 text-xs text-gray-600">{line.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <PrintFooter />
          </div>
        ))}
    </PrintLayout>
  );
}
