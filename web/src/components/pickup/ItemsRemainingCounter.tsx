import type { OrderLine } from '@/types/order.js';

interface ItemsRemainingCounterProps {
  lines: OrderLine[];
}

export function ItemsRemainingCounter({ lines }: ItemsRemainingCounterProps) {
  const remaining = lines.reduce(
    (sum, line) => sum + Math.max(0, line.qtyOrdered - line.qtyFulfilled),
    0,
  );

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Items Remaining
      </div>
      <div
        className={`text-6xl font-bold tabular-nums transition-colors duration-300 ${
          remaining === 0 ? 'text-green-600' : 'text-gray-900'
        }`}
      >
        {remaining}
      </div>
    </div>
  );
}
