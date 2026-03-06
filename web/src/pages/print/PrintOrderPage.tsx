import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { resolvePrintReturnTo } from '@/utils/printRoutes.js';
import type { Order } from '@/types/order.js';
import type { Customer } from '@/types/customer.js';

export function PrintOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    ordersApi
      .getById(orderId!)
      .then(async (o) => {
        setOrder(o);
        const c = await customersApi.getById(o.customerId);
        setCustomer(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <LoadingSpinner />;
  if (error || !order) return <ErrorBanner message={error ?? 'Order not found'} />;

  const backTo = resolvePrintReturnTo(searchParams.get('returnTo'), `/orders/${order.id}`);

  return (
    <PrintLayout backTo={backTo}>
      <PrintHeader
        subtitle="Customer Order Sheet"
        customerName={order.customerDisplayName}
        orderNumber={order.orderNumber}
        pickupCode={customer?.pickupCode}
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
    </PrintLayout>
  );
}
