import { useMemo } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import type { Order } from '@/types/order.js';
import type { Customer } from '@/types/customer.js';

export interface CustomerPickListSheetProps {
  customer: Customer;
  orders: Order[];
  sortBy?: 'name' | 'qty';
  printedAt?: string;
}

interface AggregatedRow {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
  qtyFulfilled: number;
}

function aggregateLines(orders: Order[]): AggregatedRow[] {
  const byPlant = new Map<string, AggregatedRow>();

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      const existing = byPlant.get(line.plantCatalogId);
      if (existing) {
        existing.qtyOrdered += line.qtyOrdered;
        existing.qtyFulfilled += line.qtyFulfilled;
      } else {
        byPlant.set(line.plantCatalogId, {
          plantCatalogId: line.plantCatalogId,
          plantName: line.plantName,
          plantSku: line.plantSku,
          qtyOrdered: line.qtyOrdered,
          qtyFulfilled: line.qtyFulfilled,
        });
      }
    });
  });

  return [...byPlant.values()];
}

/**
 * Single-sheet compact customer pick list:
 * - PrintHeader
 * - One PLB- barcode at top with `data-picklist-barcode` (SS-08 ScanSessionService keys off this)
 * - Top-line stat row
 * - Aggregated "Plants to Pick" table
 * - Two-column "Orders in this pickup" list
 *
 * Shared between PrintCustomerPickListPage (Sheet 1) and PrintCustomersBatchPage.
 */
export function CustomerPickListSheet({
  customer,
  orders,
  sortBy = 'name',
  printedAt,
}: CustomerPickListSheetProps) {
  const resolvedPrintedAt = useMemo(
    () => printedAt ?? new Date().toLocaleString(),
    [printedAt],
  );

  const aggregatedRows = useMemo(() => {
    const rows = aggregateLines(orders);
    if (sortBy === 'qty') {
      rows.sort((a, b) => b.qtyOrdered - a.qtyOrdered);
    } else {
      rows.sort((a, b) => a.plantName.localeCompare(b.plantName));
    }
    return rows;
  }, [orders, sortBy]);

  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return sorted;
  }, [orders]);

  const totalOrdered = aggregatedRows.reduce((sum, r) => sum + r.qtyOrdered, 0);
  const totalFulfilled = aggregatedRows.reduce((sum, r) => sum + r.qtyFulfilled, 0);

  return (
    <section>
      <PrintHeader
        subtitle="Customer Pick List"
        customerName={customer.displayName}
        pickupCode={customer.pickupCode}
        timestamp={resolvedPrintedAt}
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
        <span>{orders.length} orders</span>
        <span className="text-gray-400">&bull;</span>
        <span>{totalOrdered} total plants</span>
        <span className="text-gray-400">&bull;</span>
        <span>Date: {resolvedPrintedAt}</span>
      </div>

      <h2 className="mt-4 mb-2 text-lg font-bold">Plants to Pick</h2>

      {orders.length === 0 ? (
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
                    <li
                      key={order.id}
                      className="flex justify-between border-b border-gray-200 py-1"
                    >
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
  );
}
