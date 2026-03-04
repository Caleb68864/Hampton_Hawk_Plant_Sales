import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

export interface QuickFindFallbackOption {
  order: Order;
  customer?: Customer;
  reason: string;
}

export function resolveFallbackOrderMatches(orderItems: Order[], customers: Customer[]) {
  if (orderItems.length === 1) {
    return {
      navigateToOrderId: orderItems[0].id,
      options: [] as QuickFindFallbackOption[],
    };
  }

  if (orderItems.length > 1) {
    return {
      navigateToOrderId: null,
      options: orderItems.map((order) => ({
        order,
        customer: customers.find((c) => c.id === order.customerId),
        reason: 'Possible match',
      })),
    };
  }

  return {
    navigateToOrderId: null,
    options: [] as QuickFindFallbackOption[],
  };
}
