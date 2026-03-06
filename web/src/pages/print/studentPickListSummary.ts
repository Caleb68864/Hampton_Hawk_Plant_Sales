import type { Order } from '@/types/order.js';

export interface StudentPickListRow {
  plantName: string;
  totalNeeded: number;
}

export function buildStudentPickListSummary(orders: Order[]): StudentPickListRow[] {
  const totals = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.lines) {
      const key = line.plantName.trim();
      if (!key) continue;
      totals.set(key, (totals.get(key) ?? 0) + line.qtyOrdered);
    }
  }

  return [...totals.entries()]
    .map(([plantName, totalNeeded]) => ({ plantName, totalNeeded }))
    .sort((left, right) => left.plantName.localeCompare(right.plantName));
}
