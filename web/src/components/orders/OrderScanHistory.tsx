import { useEffect, useState } from 'react';
import { ordersApi } from '@/api/orders.js';
import type { FulfillmentEvent, FulfillmentEventSource } from '@/types/fulfillment.js';

const SOURCE_LABELS: Record<FulfillmentEventSource, string> = {
  PickupScan: 'Pickup scan',
  SessionScan: 'Pick-list scan',
  ManualFulfill: 'Manual fulfil',
  Undo: 'Undo',
};

/**
 * The order's scan history: when, what happened, which write path and which
 * signed-in account (a station login on sale day, not a volunteer's name). The
 * API has returned user and source since attribution landed; nothing showed them.
 */
export function OrderScanHistory({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<FulfillmentEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getEvents(orderId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load scan history');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4" aria-label="Scan history">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Scan history</h2>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!error && events === null && <p className="text-sm text-gray-500">Loading...</p>}
      {events && events.length === 0 && <p className="text-sm text-gray-500">No scans yet.</p>}
      {events && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="py-1 pr-3">When</th>
                <th className="py-1 pr-3">Result</th>
                <th className="py-1 pr-3">How</th>
                <th className="py-1 pr-3">Station login</th>
                <th className="py-1">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="py-1 pr-3 whitespace-nowrap text-gray-600">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-1 pr-3">{e.result}</td>
                  <td className="py-1 pr-3">{e.source ? (SOURCE_LABELS[e.source] ?? e.source) : '—'}</td>
                  <td className="py-1 pr-3">{e.userName ?? (e.userId ? 'Unknown account' : '—')}</td>
                  <td className="py-1 text-gray-600">{e.message ?? e.barcode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
