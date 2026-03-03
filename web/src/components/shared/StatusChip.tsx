import type { OrderStatus } from '@/types/order.js';

interface StatusChipProps {
  status: OrderStatus;
  hasIssue?: boolean;
}

const colorMap: Record<OrderStatus, string> = {
  Open: 'bg-gray-100 text-gray-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Complete: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export function StatusChip({ status, hasIssue }: StatusChipProps) {
  const colors = hasIssue ? 'bg-amber-100 text-amber-700' : colorMap[status];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {hasIssue ? `${status} (Issue)` : status}
    </span>
  );
}
