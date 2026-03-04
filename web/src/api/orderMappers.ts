import type { Order } from '../types/order.ts';

interface ApiOrderParty {
  displayName: string;
}

export interface ApiOrder extends Omit<Order, 'customerDisplayName' | 'sellerDisplayName'> {
  customer: ApiOrderParty | null;
  seller: ApiOrderParty | null;
}

export function mapApiOrder(order: ApiOrder): Order {
  return {
    ...order,
    customerDisplayName: order.customer?.displayName ?? '',
    sellerDisplayName: order.seller?.displayName ?? null,
    lines: order.lines.map((line) => ({ ...line })),
  };
}
