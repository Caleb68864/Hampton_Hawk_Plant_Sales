import type { Order, OrderCustomerSummary } from '../types/order.js';

export interface CustomerWithOrders {
  customer: OrderCustomerSummary & { id: string };
  orders: Order[];
}

/**
 * Groups one orders search into the lookup's customer rows. The server's order
 * search matches what the customer search did (name, last name, phone, pickup
 * code) plus order number and barcode, so this replaces "list customers, then
 * fetch each customer's orders". Walk-up register sales carry no customer and are
 * left out, as before. Rows sort by display name, as the customer list did.
 *
 * `azFilter` is the A-Z tab: a letter keeps customers whose last name starts with
 * it, '#' those whose last name does not start with a letter; customers with no
 * last name are left out under either, as before.
 */
export function groupOrdersByCustomer(orders: Order[], azFilter: string | null = null): CustomerWithOrders[] {
  const rows = new Map<string, CustomerWithOrders>();
  for (const order of orders) {
    const customer = order.customer;
    if (!order.customerId || !customer) continue;
    let row = rows.get(order.customerId);
    if (!row) {
      row = { customer: { ...customer, id: order.customerId }, orders: [] };
      rows.set(order.customerId, row);
    }
    if (!row.orders.some((o) => o.id === order.id)) row.orders.push(order);
  }

  let result = [...rows.values()];
  if (azFilter) {
    result = result.filter(({ customer }) => {
      const last = customer.lastName;
      if (!last) return false;
      return azFilter === '#' ? !/^[A-Za-z]/.test(last) : last.toUpperCase().startsWith(azFilter);
    });
  }
  return result.sort((a, b) =>
    a.customer.displayName.localeCompare(b.customer.displayName, undefined, { sensitivity: 'base' }));
}
