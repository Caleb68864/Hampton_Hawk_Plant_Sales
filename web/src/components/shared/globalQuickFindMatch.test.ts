import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBestMatch } from './globalQuickFindMatch.ts';
import type { Customer } from '../../types/customer.js';
import type { Order } from '../../types/order.js';

const now = '2026-01-01T00:00:00.000Z';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: 'customer-1',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    phone: '555-0100',
    email: null,
    pickupCode: 'PICK123',
    picklistBarcode: 'PLB-TEST0001',
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    customerDisplayName: 'Jane Doe',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: 'HH-1001',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('phone search routes using customerId orders when direct order search has no overlap', async () => {
  const customer = makeCustomer({ id: 'customer-phone', phone: '(804) 555-1200', displayName: 'Jane Phone' });
  const customerOrder = makeOrder({ id: 'order-phone', customerId: customer.id, customerDisplayName: customer.displayName });

  const orderCalls: Array<{ search?: string; customerId?: string; pageSize: number }> = [];
  const decision = await resolveBestMatch('5551200', {
    listOrders: async (params) => {
      orderCalls.push(params);
      if (params.customerId === customer.id) {
        return { items: [customerOrder] };
      }

      return { items: [makeOrder({ id: 'order-other', customerId: 'other-customer' })] };
    },
    listCustomers: async () => ({ items: [customer] }),
    listPlants: async () => ({ items: [] }),
  });

  assert.deepEqual(decision, { type: 'navigate', route: `/pickup/${customerOrder.id}` });
  assert.deepEqual(orderCalls, [
    { search: '5551200', pageSize: 25 },
    { customerId: customer.id, pageSize: 25 },
  ]);
});

test('customer name search shows options from customerId orders when direct order search misses customer orders', async () => {
  const customer = makeCustomer({ id: 'customer-name', displayName: 'Garden Club' });
  const customerOrders = [
    makeOrder({ id: 'order-a', customerId: customer.id, customerDisplayName: customer.displayName }),
    makeOrder({ id: 'order-b', customerId: customer.id, customerDisplayName: customer.displayName }),
  ];

  const decision = await resolveBestMatch('Garden Club', {
    listOrders: async (params) => {
      if (params.customerId === customer.id) {
        return { items: customerOrders };
      }

      return { items: [] };
    },
    listCustomers: async () => ({ items: [customer] }),
    listPlants: async () => ({ items: [] }),
  });

  assert.equal(decision.type, 'options');
  if (decision.type !== 'options') return;

  assert.equal(decision.options.length, 2);
  assert.equal(decision.options[0].reason, 'Closest customer name match');
  assert.equal(decision.options[1].reason, 'Closest customer name match');
  assert.deepEqual(
    decision.options.map((option) => option.order?.id),
    ['order-a', 'order-b'],
  );
  assert.deepEqual(
    decision.options.map((option) => option.route),
    ['/pickup/order-a', '/pickup/order-b'],
  );
});

test('single fuzzy order result navigates directly', async () => {
  const order = makeOrder({ id: 'order-single', orderNumber: 'HH-1009' });

  const decision = await resolveBestMatch('1009', {
    listOrders: async () => ({ items: [order] }),
    listCustomers: async () => ({ items: [] }),
    listPlants: async () => ({ items: [] }),
  });

  assert.deepEqual(decision, { type: 'navigate', route: '/pickup/order-single' });
});

test('single plant result navigates to plant detail', async () => {
  const decision = await resolveBestMatch('AZ-001', {
    listOrders: async () => ({ items: [] }),
    listCustomers: async () => ({ items: [] }),
    listPlants: async () => ({
      items: [
        {
          id: 'plant-1',
          sku: 'AZ-001',
          name: 'Aloe Vera',
          variant: null,
          price: 10,
          barcode: '100200300',
          isActive: true,
          barcodeLockedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
    }),
  });

  assert.deepEqual(decision, { type: 'navigate', route: '/plants/plant-1' });
});
