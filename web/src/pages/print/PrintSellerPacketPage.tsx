import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { sellersApi } from '@/api/sellers.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
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
  const [sortBy, setSortBy] = useState<'name' | 'order'>('name');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      sellersApi.getById(sellerId!),
      ordersApi.list({ sellerId: sellerId!, pageSize: 500 }),
    ])
      .then(async ([s, result]) => {
        setSeller(s);
        setOrders(result.items);
        const uniqueIds = [...new Set(result.items.map((o) => o.customerId))];
        const custMap = new Map<string, Customer>();
        await Promise.all(
          uniqueIds.map((id) =>
            customersApi.getById(id).then((c) => custMap.set(id, c))
          )
        );
        setCustomers(custMap);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load seller data'))
      .finally(() => setLoading(false));
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

  if (loading) return <LoadingSpinner />;
  if (error || !seller) return <ErrorBanner message={error ?? 'Seller not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/sellers/${seller.id}`);

  return (
    <PrintLayout backTo={backTo}>
      <div className="no-print mb-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Print Options</h2>
        <div className="flex flex-wrap gap-4 items-center">
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
            <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
            <select
              className="text-sm border border-gray-300 rounded px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'order')}
            >
              <option value="name">Customer Last Name</option>
              <option value="order">Order Number</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Showing {filteredOrders.length} of {orders.length} orders for {seller.displayName}
        </p>
      </div>

      {filteredOrders.map((order, idx) => {
        const customer = customers.get(order.customerId);
        return (
          <div key={order.id} className={idx < filteredOrders.length - 1 ? 'page-break' : ''}>
            <PrintHeader
              subtitle={`Seller Packet - ${seller.displayName}`}
              customerName={order.customerDisplayName}
              orderNumber={order.orderNumber}
              pickupCode={customer?.pickupCode}
              sellerName={seller.displayName}
              timestamp={new Date(order.createdAt).toLocaleString()}
            />

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 px-1 text-left w-8"></th>
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

      {filteredOrders.length === 0 && (
        <p className="text-center text-gray-500 py-12">No orders match the current filters.</p>
      )}
    </PrintLayout>
  );
}
