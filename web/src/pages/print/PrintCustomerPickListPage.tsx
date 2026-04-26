import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { CustomerPickListSheet } from '@/components/print/CustomerPickListSheet.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import type { Order } from '@/types/order.js';
import type { Customer } from '@/types/customer.js';

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

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return sorted;
  }, [filteredOrders]);

  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  if (loading) return <LoadingSpinner />;
  if (error || !customer) return <ErrorBanner message={error ?? 'Customer not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/customers/${customer.id}`);

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
      <CustomerPickListSheet
        customer={customer}
        orders={filteredOrders}
        sortBy={sortBy}
        printedAt={printedAt}
      />

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
