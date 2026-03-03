import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import type { Order } from '@/types/order.js';

function parseOrderIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function PrintOrdersBatchPage() {
  const [searchParams] = useSearchParams();
  const orderIds = useMemo(() => parseOrderIds(searchParams.get('ids')), [searchParams]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all(orderIds.map((id) => ordersApi.getById(id)))
      .then((results) => {
        const byId = new Map(results.map((order) => [order.id, order]));
        setOrders(orderIds.map((id) => byId.get(id)).filter((order): order is Order => Boolean(order)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, [orderIds]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (orderIds.length === 0) return <ErrorBanner message="No orders were selected to print." />;

  return (
    <PrintLayout backTo="/orders">
      {orders.map((order, idx) => (
        <section key={order.id} className={idx < orders.length - 1 ? 'page-break' : ''}>
          <PrintHeader
            subtitle="Customer Order Sheet"
            customerName={order.customerDisplayName}
            orderNumber={order.orderNumber}
            sellerName={order.sellerDisplayName ?? undefined}
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
                  <td className="py-2 px-2 text-right font-semibold">{line.qtyOrdered - line.qtyFulfilled}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-2 px-1"></td>
                <td className="py-2 px-2" colSpan={2}>Total</td>
                <td className="py-2 px-2 text-right">{order.lines.reduce((sum, line) => sum + line.qtyOrdered, 0)}</td>
                <td className="py-2 px-2 text-right">{order.lines.reduce((sum, line) => sum + line.qtyFulfilled, 0)}</td>
                <td className="py-2 px-2 text-right">{order.lines.reduce((sum, line) => sum + (line.qtyOrdered - line.qtyFulfilled), 0)}</td>
              </tr>
            </tfoot>
          </table>

          <PrintFooter />
        </section>
      ))}
    </PrintLayout>
  );
}
