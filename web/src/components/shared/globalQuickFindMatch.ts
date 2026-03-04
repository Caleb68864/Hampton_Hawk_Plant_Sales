import type { Customer } from '../../types/customer.js';
import type { Order } from '../../types/order.js';

export interface MatchOption {
  order: Order;
  customer?: Customer;
  reason: string;
}

interface ListResult<T> {
  items: T[];
}

interface ResolveBestMatchDeps {
  listOrders: (params: { search?: string; customerId?: string; pageSize: number }) => Promise<ListResult<Order>>;
  listCustomers: (params: { search: string; pageSize: number }) => Promise<ListResult<Customer>>;
}

export type BestMatchDecision =
  | { type: 'navigate'; orderId: string }
  | { type: 'options'; options: MatchOption[] }
  | { type: 'none' };

export function normalizeScanInput(value: string) {
  return value
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/#+$/g, '');
}

export function normalizeKey(value: string) {
  return normalizeScanInput(value).toUpperCase();
}

function customerScore(customer: Customer, query: string) {
  const display = (customer.displayName ?? '').toUpperCase();
  const compactQuery = query.replace(/\s+/g, ' ').trim();
  if (display === compactQuery) return 3;
  if (display.startsWith(compactQuery)) return 2;
  if (display.includes(compactQuery)) return 1;
  return 0;
}

function phoneScore(customer: Customer, query: string) {
  const queryDigits = query.replace(/\D/g, '');
  const customerDigits = (customer.phone ?? '').replace(/\D/g, '');
  if (!queryDigits || !customerDigits) return 0;
  if (customerDigits === queryDigits) return 4;
  if (customerDigits.endsWith(queryDigits)) return 3;
  if (customerDigits.includes(queryDigits)) return 2;
  return 0;
}

export async function resolveBestMatch(query: string, deps: ResolveBestMatchDeps): Promise<BestMatchDecision> {
  const normalized = normalizeScanInput(query);
  const normalizedKey = normalizeKey(query);
  const pageSize = 25;

  if (!normalized) return { type: 'none' };

  const [orderRes, customerRes] = await Promise.all([
    deps.listOrders({ search: normalized, pageSize }),
    deps.listCustomers({ search: normalized, pageSize }),
  ]);

  const exactOrder = orderRes.items.find((order) => normalizeKey(order.orderNumber) === normalizedKey);
  if (exactOrder) {
    return { type: 'navigate', orderId: exactOrder.id };
  }

  const customerOrderCache = new Map<string, Order[]>();
  const loadOrdersByCustomer = async (customer: Customer) => {
    if (!customerOrderCache.has(customer.id)) {
      const result = await deps.listOrders({ customerId: customer.id, pageSize });
      customerOrderCache.set(customer.id, result.items);
    }

    return customerOrderCache.get(customer.id) ?? [];
  };

  const exactPickupCustomers = customerRes.items.filter((customer) => normalizeKey(customer.pickupCode ?? '') === normalizedKey);

  if (exactPickupCustomers.length > 0) {
    const pickupOrderMatches = await Promise.all(
      exactPickupCustomers.map(async (customer) => {
        const orders = await loadOrdersByCustomer(customer);
        return orders.map((order) => ({ order, customer }));
      }),
    );

    const pickupOrders = pickupOrderMatches.flat();

    if (pickupOrders.length === 1) {
      return { type: 'navigate', orderId: pickupOrders[0].order.id };
    }

    if (pickupOrders.length > 1) {
      return {
        type: 'options',
        options: pickupOrders.map((match) => ({
          order: match.order,
          customer: match.customer,
          reason: 'Exact pickup code match',
        })),
      };
    }
  }

  const rankedCustomer = customerRes.items
    .map((customer) => ({
      customer,
      score: Math.max(customerScore(customer, normalizedKey), phoneScore(customer, normalized)),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (rankedCustomer && rankedCustomer.score > 0) {
    const customerOrders = await loadOrdersByCustomer(rankedCustomer.customer);
    if (customerOrders.length === 1) {
      return { type: 'navigate', orderId: customerOrders[0].id };
    }

    if (customerOrders.length > 1) {
      return {
        type: 'options',
        options: customerOrders.map((order) => ({
          order,
          customer: rankedCustomer.customer,
          reason: 'Closest customer name match',
        })),
      };
    }
  }

  if (orderRes.items.length > 1) {
    return {
      type: 'options',
      options: orderRes.items.map((order) => ({
        order,
        customer: customerRes.items.find((customer) => customer.id === order.customerId),
        reason: 'Possible match',
      })),
    };
  }

  return { type: 'none' };
}
