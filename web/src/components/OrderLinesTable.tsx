import type { OrderLine } from '@/types/order.js';

interface OrderLinesTableProps {
  lines: OrderLine[];
  showFulfillment?: boolean;
}

export function OrderLinesTable({ lines, showFulfillment = true }: OrderLinesTableProps) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Ordered</th>
          {showFulfillment && (
            <>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Fulfilled</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            </>
          )}
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {lines.map((line) => {
          const pct = line.qtyOrdered > 0 ? Math.round((line.qtyFulfilled / line.qtyOrdered) * 100) : 0;
          const isComplete = line.qtyFulfilled >= line.qtyOrdered;
          return (
            <tr key={line.id} className={isComplete ? 'bg-green-50' : ''}>
              <td className="px-4 py-3 text-sm text-gray-900">{line.plantName}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{line.plantSku}</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{line.qtyOrdered}</td>
              {showFulfillment && (
                <>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={isComplete ? 'text-green-700 font-medium' : 'text-gray-900'}>
                      {line.qtyFulfilled}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                  </td>
                </>
              )}
              <td className="px-4 py-3 text-sm text-gray-500">{line.notes ?? '--'}</td>
            </tr>
          );
        })}
        {lines.length === 0 && (
          <tr>
            <td colSpan={showFulfillment ? 6 : 4} className="px-4 py-6 text-center text-sm text-gray-500">
              No line items
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
