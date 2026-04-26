import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { sellersApi } from '@/api/sellers.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import { buildStudentPickListSummary } from './studentPickListSummary.js';
import type { Order } from '@/types/order.js';
import type { Seller } from '@/types/seller.js';
import type { Customer } from '@/types/customer.js';

export function PrintSellerPacketPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams] = useSearchParams();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [includePreorders, setIncludePreorders] = useState(true);
  const [includeWalkups, setIncludeWalkups] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includePerOrderDetail, setIncludePerOrderDetail] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'qty'>('name');

  useEffect(() => {
    let cancelled = false;

    async function loadSellerPacket() {
      setLoading(true);
      setError(null);

      try {
        const [sellerRecord, orderListResult] = await Promise.all([
          sellersApi.getById(sellerId!),
          ordersApi.list({ sellerId: sellerId!, pageSize: 500 }),
        ]);

        const fullOrders = await Promise.all(orderListResult.items.map((order) => ordersApi.getById(order.id)));
        const uniqueCustomerIds = [...new Set(fullOrders.map((order) => order.customerId))];
        const customerEntries = await Promise.all(
          uniqueCustomerIds.map(async (id) => [id, await customersApi.getById(id)] as const),
        );

        if (cancelled) {
          return;
        }

        setSeller(sellerRecord);
        setOrders(fullOrders);
        setCustomers(new Map(customerEntries));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load seller data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSellerPacket();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((o) => {
      if (!includePreorders && !o.isWalkUp) return false;
      if (!includeWalkups && o.isWalkUp) return false;
      if (!includeCompleted && o.status === 'Complete') return false;
      return true;
    });

    // Per-order detail sheets sort by customer name for predictability
    filtered.sort((a, b) => a.customerDisplayName.localeCompare(b.customerDisplayName));

    return filtered;
  }, [orders, includePreorders, includeWalkups, includeCompleted]);

  // SKU lookup so the aggregated summary can show SKUs alongside plant name
  const skuByPlantName = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of filteredOrders) {
      for (const line of order.lines) {
        const key = line.plantName.trim();
        if (key && !map.has(key)) {
          map.set(key, line.plantSku);
        }
      }
    }
    return map;
  }, [filteredOrders]);

  const pickListSummary = useMemo(() => {
    const rows = buildStudentPickListSummary(filteredOrders);
    if (sortBy === 'qty') {
      return [...rows].sort((a, b) => b.totalNeeded - a.totalNeeded);
    }
    return rows;
  }, [filteredOrders, sortBy]);

  const totalPlants = useMemo(
    () => pickListSummary.reduce((sum, row) => sum + row.totalNeeded, 0),
    [pickListSummary],
  );

  const customerSummaries = useMemo(() => {
    const byCustomer = new Map<string, { name: string; pickupCode?: string; totalQty: number }>();
    for (const order of filteredOrders) {
      const cust = customers.get(order.customerId);
      const key = order.customerId;
      const qty = order.lines.reduce((s, l) => s + l.qtyOrdered, 0);
      const existing = byCustomer.get(key);
      if (existing) {
        existing.totalQty += qty;
      } else {
        byCustomer.set(key, {
          name: cust?.displayName ?? order.customerDisplayName,
          pickupCode: cust?.pickupCode,
          totalQty: qty,
        });
      }
    }
    return [...byCustomer.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredOrders, customers]);

  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  if (loading) return <LoadingSpinner />;
  if (error || !seller) return <ErrorBanner message={error ?? 'Seller not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/sellers/${seller.id}`);

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
          Showing {filteredOrders.length} of {orders.length} orders for {seller.displayName}.
          {' '}Default layout is one or two sheets; turn on per-order detail to add follow-on sheets.
        </p>
      </div>

      {/* Sheet 1 -- always rendered: single barcode + aggregated plant needs */}
      <section>
        <PrintHeader
          subtitle="Seller Pick List"
          sellerName={seller.displayName}
          timestamp={printedAt}
        />

        {seller.picklistBarcode ? (
          <div
            className="mb-4 flex flex-col items-center"
            data-picklist-barcode={seller.picklistBarcode}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
              SCAN TO PULL ALL ORDERS
            </p>
            <OrderNumberBarcode value={seller.picklistBarcode} variant="bare" />
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            No pick-list barcode -- admin must regenerate via Sellers page.
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-b border-gray-300 py-2 text-sm">
          <span className="font-semibold">{seller.displayName}</span>
          <span className="text-gray-400">&bull;</span>
          <span>{filteredOrders.length} orders</span>
          <span className="text-gray-400">&bull;</span>
          <span>{customerSummaries.length} customers</span>
          <span className="text-gray-400">&bull;</span>
          <span>{totalPlants} total plants</span>
          <span className="text-gray-400">&bull;</span>
          <span>Date: {printedAt}</span>
        </div>

        <h2 className="mt-4 mb-2 text-lg font-bold">Plants to Pick</h2>

        {filteredOrders.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No orders match the current filters.</p>
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
                {pickListSummary.map((row) => (
                  <tr key={row.plantName} className="border-b border-gray-300">
                    <td className="py-1.5 px-1">
                      <span className="print-checkbox" />
                    </td>
                    <td className="py-1.5 px-2">{row.plantName}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">
                      {skuByPlantName.get(row.plantName) ?? ''}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold tabular-nums">
                      {row.totalNeeded}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-semibold">
                  <td className="py-2 px-1"></td>
                  <td className="py-2 px-2" colSpan={2}>Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{totalPlants}</td>
                </tr>
              </tfoot>
            </table>

            {customerSummaries.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Customers in this pickup ({customerSummaries.length})
                </h3>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {customerSummaries.map((c) => (
                    <li key={c.name + (c.pickupCode ?? '')} className="flex justify-between border-b border-gray-200 py-1">
                      <span>
                        {c.name}
                        {c.pickupCode && (
                          <span className="ml-1 font-mono text-gray-500">({c.pickupCode})</span>
                        )}
                      </span>
                      <span className="tabular-nums text-gray-700">{c.totalQty} plants</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>

      {/* Sheet 2+ -- opt-in per-order detail sheets. NO seller picklist barcode here. */}
      {includePerOrderDetail &&
        filteredOrders.map((order) => {
          const customer = customers.get(order.customerId);
          return (
            <div key={order.id} className="page-break">
              <PrintHeader
                subtitle={`Order Detail - ${seller.displayName}`}
                customerName={order.customerDisplayName}
                orderNumber={order.orderNumber}
                pickupCode={customer?.pickupCode}
                sellerName={seller.displayName}
                timestamp={new Date(order.createdAt).toLocaleString()}
              />

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="w-8 py-2 px-1 text-left"></th>
                    <th className="py-2 px-2 text-left">Plant Name</th>
                    <th className="py-2 px-2 text-left">SKU</th>
                    <th className="py-2 px-2 text-right">Ordered</th>
                    <th className="py-2 px-2 text-right">Fulfilled</th>
                    <th className="py-2 px-2 text-right">Remaining</th>
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
                      <td className="py-2 px-2 text-right">{line.qtyOrdered}</td>
                      <td className="py-2 px-2 text-right">{line.qtyFulfilled}</td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {line.qtyOrdered - line.qtyFulfilled}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black font-semibold">
                    <td className="py-2 px-1"></td>
                    <td className="py-2 px-2" colSpan={2}>Total</td>
                    <td className="py-2 px-2 text-right">
                      {order.lines.reduce((s, l) => s + l.qtyOrdered, 0)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {order.lines.reduce((s, l) => s + l.qtyFulfilled, 0)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {order.lines.reduce((s, l) => s + (l.qtyOrdered - l.qtyFulfilled), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <PrintFooter />
            </div>
          );
        })}
    </PrintLayout>
  );
}
