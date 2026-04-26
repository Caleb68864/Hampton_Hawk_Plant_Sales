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
  const [includeStudentPickListSummary, setIncludeStudentPickListSummary] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'order'>('name');

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

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.customerDisplayName.localeCompare(b.customerDisplayName);
      }
      return a.orderNumber.localeCompare(b.orderNumber);
    });

    return filtered;
  }, [orders, includePreorders, includeWalkups, includeCompleted, sortBy]);

  const pickListSummary = useMemo(() => buildStudentPickListSummary(filteredOrders), [filteredOrders]);
  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  if (loading) return <LoadingSpinner />;
  if (error || !seller) return <ErrorBanner message={error ?? 'Seller not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/sellers/${seller.id}`);

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
          <label className="flex items-center gap-2 text-sm font-medium text-hawk-900">
            <input
              type="checkbox"
              checked={includeStudentPickListSummary}
              onChange={(e) => setIncludeStudentPickListSummary(e.target.checked)}
            />
            Include Student Pick List Summary
          </label>
          <div className="border-l border-gray-300 pl-4">
            <label className="mr-2 text-sm font-medium text-gray-700">Sort by:</label>
            <select
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'order')}
            >
              <option value="name">Customer Last Name</option>
              <option value="order">Order Number</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Showing {filteredOrders.length} of {orders.length} orders for {seller.displayName}
        </p>
      </div>

      {filteredOrders.map((order, idx) => {
        const customer = customers.get(order.customerId);
        const needsPageBreak = idx < filteredOrders.length - 1 || includeStudentPickListSummary;
        return (
          <div key={order.id} className={needsPageBreak ? 'page-break' : ''}>
            <PrintHeader
              subtitle={`Seller Packet - ${seller.displayName}`}
              customerName={order.customerDisplayName}
              orderNumber={order.orderNumber}
              pickupCode={customer?.pickupCode}
              sellerName={seller.displayName}
              timestamp={new Date(order.createdAt).toLocaleString()}
            />

            {seller.picklistBarcode && (
              <div className="mb-4 flex flex-col items-center" data-picklist-barcode={seller.picklistBarcode}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Seller Pick List Barcode
                </p>
                <OrderNumberBarcode value={seller.picklistBarcode} variant="bare" />
              </div>
            )}

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

      {includeStudentPickListSummary && filteredOrders.length > 0 && (
        <section>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">Hampton Hawks Plant Sales</h1>
            <p className="mt-1 text-sm text-gray-600">Student Plant Pick List Summary</p>
            {seller.picklistBarcode && (
              <div className="mx-auto mt-3 max-w-[320px]" data-picklist-barcode={seller.picklistBarcode}>
                <OrderNumberBarcode value={seller.picklistBarcode} variant="bare" />
              </div>
            )}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 border-t border-b border-gray-300 py-3 text-sm">
            <div>
              <span className="font-semibold">Student:</span> {seller.displayName}
            </div>
            <div>
              <span className="font-semibold">Orders:</span> {filteredOrders.length}
            </div>
            <div>
              <span className="font-semibold">Date Printed:</span> {printedAt}
            </div>
            <div>
              <span className="font-semibold">Total Plants Needed:</span> {pickListSummary.reduce((sum, row) => sum + row.totalNeeded, 0)}
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 px-2 text-left">Plant</th>
                <th className="py-2 px-2 text-right">Total Needed</th>
              </tr>
            </thead>
            <tbody>
              {pickListSummary.map((row) => (
                <tr key={row.plantName} className="border-b border-gray-300">
                  <td className="py-2 px-2">{row.plantName}</td>
                  <td className="py-2 px-2 text-right font-semibold">{row.totalNeeded}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-2 px-2">Total</td>
                <td className="py-2 px-2 text-right">{pickListSummary.reduce((sum, row) => sum + row.totalNeeded, 0)}</td>
              </tr>
            </tfoot>
          </table>

          <PrintFooter />
        </section>
      )}

      {filteredOrders.length === 0 && (
        <p className="py-12 text-center text-gray-500">No orders match the current filters.</p>
      )}
    </PrintLayout>
  );
}
