import { useMemo } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import { buildStudentPickListSummary } from '@/pages/print/studentPickListSummary.js';
import type { Order } from '@/types/order.js';
import type { Seller } from '@/types/seller.js';
import type { Customer } from '@/types/customer.js';

export interface SellerPickListSheetProps {
  seller: Seller;
  orders: Order[];
  customers: Map<string, Customer>;
  sortBy?: 'name' | 'qty';
  printedAt?: string;
}

/**
 * Single-sheet compact seller pick list:
 * - PrintHeader
 * - One PLS- barcode at top with `data-picklist-barcode` (SS-08 ScanSessionService keys off this)
 * - Top-line stat row
 * - Aggregated "Plants to Pick" table
 * - Two-column "Customers in this pickup" list
 *
 * Shared between PrintSellerPacketPage (Sheet 1) and PrintSellersBatchPage.
 */
export function SellerPickListSheet({
  seller,
  orders,
  customers,
  sortBy = 'name',
  printedAt,
}: SellerPickListSheetProps) {
  const resolvedPrintedAt = useMemo(
    () => printedAt ?? new Date().toLocaleString(),
    [printedAt],
  );

  const skuByPlantName = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      for (const line of order.lines) {
        const key = line.plantName.trim();
        if (key && !map.has(key)) {
          map.set(key, line.plantSku);
        }
      }
    }
    return map;
  }, [orders]);

  const pickListSummary = useMemo(() => {
    const rows = buildStudentPickListSummary(orders);
    if (sortBy === 'qty') {
      return [...rows].sort((a, b) => b.totalNeeded - a.totalNeeded);
    }
    return rows;
  }, [orders, sortBy]);

  const totalPlants = useMemo(
    () => pickListSummary.reduce((sum, row) => sum + row.totalNeeded, 0),
    [pickListSummary],
  );

  const customerSummaries = useMemo(() => {
    const byCustomer = new Map<string, { name: string; pickupCode?: string; totalQty: number }>();
    for (const order of orders) {
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
  }, [orders, customers]);

  return (
    <section>
      <PrintHeader
        subtitle="Seller Pick List"
        sellerName={seller.displayName}
        timestamp={resolvedPrintedAt}
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
        <span>{orders.length} orders</span>
        <span className="text-gray-400">&bull;</span>
        <span>{customerSummaries.length} customers</span>
        <span className="text-gray-400">&bull;</span>
        <span>{totalPlants} total plants</span>
        <span className="text-gray-400">&bull;</span>
        <span>Date: {resolvedPrintedAt}</span>
      </div>

      <h2 className="mt-4 mb-2 text-lg font-bold">Plants to Pick</h2>

      {orders.length === 0 ? (
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
                  <li
                    key={c.name + (c.pickupCode ?? '')}
                    className="flex justify-between border-b border-gray-200 py-1"
                  >
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
  );
}
