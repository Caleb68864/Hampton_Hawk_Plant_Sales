import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOrdersByCustomer } from './pickupLookup.ts';
import type { Order } from '../types/order.js';

const customer = (id: string, displayName: string, lastName: string | null) =>
  ({ id, displayName, lastName, pickupCode: `PC${id}` }) as unknown as NonNullable<Order['customer']>;
const order = (id: string, c: ReturnType<typeof customer> | null) =>
  ({ id, customerId: c?.id ?? null, customer: c, orderNumber: id }) as unknown as Order;

const smith = customer('c1', 'Zed Smith', 'Smith');
const adams = customer('c2', 'amy Adams', 'Adams');
const numeric = customer('c3', '3M Club', '3M');
const noLast = customer('c4', 'Mystery', null);

test('one customer row per customer, holding all of their orders', () => {
  const rows = groupOrdersByCustomer([order('o1', smith), order('o2', adams), order('o3', smith)]);
  assert.deepEqual(rows.map((r) => [r.customer.id, r.orders.map((o) => o.id)]), [
    ['c2', ['o2']],
    ['c1', ['o1', 'o3']],
  ]);
});

test('walk-up sales without a customer are left out', () => {
  assert.deepEqual(groupOrdersByCustomer([order('w1', null)]), []);
});

test('a repeated order is listed once', () => {
  assert.equal(groupOrdersByCustomer([order('o1', smith), order('o1', smith)])[0].orders.length, 1);
});

test('the A-Z tab filters by last-name initial, # by a non-letter initial', () => {
  const all = [order('o1', smith), order('o2', adams), order('o3', numeric), order('o4', noLast)];
  assert.deepEqual(groupOrdersByCustomer(all, 'S').map((r) => r.customer.id), ['c1']);
  assert.deepEqual(groupOrdersByCustomer(all, '#').map((r) => r.customer.id), ['c3']);
});
