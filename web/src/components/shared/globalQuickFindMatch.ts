import type { Customer } from '../../types/customer.js';
import type { Order } from '../../types/order.js';
import type { Plant } from '../../types/plant.js';

export interface MatchOption {
  order?: Order;
  plant?: Plant;
  customer?: Customer;
  reason: string;
  route: string;
}

interface ListResult<T> {
  items: T[];
}

interface ResolveBestMatchDeps {
  listOrders: (params: { search?: string; customerId?: string; pageSize: number }) => Promise<ListResult<Order>>;
  listCustomers: (params: { search: string; pageSize: number }) => Promise<ListResult<Customer>>;
  listPlants: (params: { search: string; pageSize: number }) => Promise<ListResult<Plant>>;
}

export type BestMatchDecision =
  | { type: 'navigate'; route: string }
  | { type: 'options'; options: MatchOption[] }
  | { type: 'none' };

export function normalizeScanInput(value: string) {
  const base = value
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/#+$/g, '');
  if (/^0+\d/.test(base)) {
    const stripped = base.replace(/^0+/, '');
    return stripped.length > 0 ? stripped : '0';
  }
  return base;
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

  const [orderRes, customerRes, plantRes] = await Promise.all([
    deps.listOrders({ search: normalized, pageSize }),
    deps.listCustomers({ search: normalized, pageSize }),
    deps.listPlants({ search: normalized, pageSize }),
  ]);

  const exactOrder = orderRes.items.find((order) => normalizeKey(order.orderNumber) === normalizedKey);
  if (exactOrder) {
    return { type: 'navigate', route: `/pickup/${exactOrder.id}` };
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
      return { type: 'navigate', route: `/pickup/${pickupOrders[0].order.id}` };
    }

    if (pickupOrders.length > 1) {
      return {
        type: 'options',
        options: pickupOrders.map((match) => ({
          order: match.order,
          customer: match.customer,
          reason: 'Exact pickup code match',
          route: `/pickup/${match.order.id}`,
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
      return { type: 'navigate', route: `/pickup/${customerOrders[0].id}` };
    }

    if (customerOrders.length > 1) {
      return {
        type: 'options',
        options: customerOrders.map((order) => ({
          order,
          customer: rankedCustomer.customer,
          reason: 'Closest customer name match',
          route: `/pickup/${order.id}`,
        })),
      };
    }
  }

  const exactPlants = plantRes.items.filter((plant) =>
    normalizeKey(plant.sku) === normalizedKey || normalizeKey(plant.barcode) === normalizedKey,
  );

  if (exactPlants.length === 1) {
    return { type: 'navigate', route: `/plants/${exactPlants[0].id}` };
  }

  if (exactPlants.length > 1) {
    return {
      type: 'options',
      options: exactPlants.map((plant) => ({
        plant,
        reason: 'Exact plant SKU/barcode match',
        route: `/plants/${plant.id}`,
      })),
    };
  }

  if (plantRes.items.length === 1) {
    return { type: 'navigate', route: `/plants/${plantRes.items[0].id}` };
  }

  if (plantRes.items.length > 1) {
    return {
      type: 'options',
      options: plantRes.items.map((plant) => ({
        plant,
        reason: 'Possible plant match',
        route: `/plants/${plant.id}`,
      })),
    };
  }

  if (orderRes.items.length === 1) {
    return { type: 'navigate', route: `/pickup/${orderRes.items[0].id}` };
  }

  if (orderRes.items.length > 1) {
    return {
      type: 'options',
      options: orderRes.items.map((order) => ({
        order,
        customer: customerRes.items.find((customer) => customer.id === order.customerId),
        reason: 'Possible match',
        route: `/pickup/${order.id}`,
      })),
    };
  }

  return { type: 'none' };
}
