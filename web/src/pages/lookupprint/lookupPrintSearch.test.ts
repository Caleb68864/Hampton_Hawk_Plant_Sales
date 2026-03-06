import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLookupPrintLetterRows,
  buildLookupPrintRecentRows,
  buildLookupPrintRows,
  matchesLookupPrintLetterFilter,
} from './lookupPrintSearch.ts';
import type { Customer } from '../../types/customer.ts';
import type { Order } from '../../types/order.ts';

const customers = new Map<string, Customer>([
  ['customer-1', {
    id: 'customer-1',
    firstName: 'Alice',
    lastName: 'Smith',
    displayName: 'Alice Smith',
    phone: null,
    email: null,
    pickupCode: 'PICK-100',
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }],
  ['customer-2', {
    id: 'customer-2',
    firstName: 'Bob',
    lastName: 'Jones',
    displayName: 'Bob Jones',
    phone: null,
    email: null,
    pickupCode: 'ALICE-200',
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }],
]);

const orders: Order[] = [
  {
    id: 'order-1',
    customerId: 'customer-1',
    customerDisplayName: 'Alice Smith',
    sellerId: 'seller-1',
    sellerDisplayName: 'Seller One',
    orderNumber: '1001',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'order-2',
    customerId: 'customer-2',
    customerDisplayName: 'Bob Jones',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: '2002',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];

const recentOrders: Order[] = [
  {
    id: 'order-3',
    customerId: 'customer-1',
    customerDisplayName: 'Alice Smith',
    sellerId: 'seller-1',
    sellerDisplayName: 'Seller One',
    orderNumber: '3003',
    status: 'InProgress',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-03-03T00:00:00.000Z',
    updatedAt: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'order-4',
    customerId: 'customer-2',
    customerDisplayName: 'Bob Jones',
    sellerId: null,
    sellerDisplayName: null,
    orderNumber: '4004',
    status: 'Open',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z',
  },
  {
    id: 'order-5',
    customerId: 'customer-1',
    customerDisplayName: 'Alice Smith',
    sellerId: 'seller-1',
    sellerDisplayName: 'Seller One',
    orderNumber: '5005',
    status: 'Complete',
    isWalkUp: false,
    hasIssue: false,
    lines: [],
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z',
  },
];

test('ranks exact order-number and pickup-code matches above fuzzy customer matches', () => {
  const orderMatch = buildLookupPrintRows('1001', orders, customers);
  assert.equal(orderMatch[0]?.orderId, 'order-1');

  const pickupCodeMatch = buildLookupPrintRows('pick-100', orders, customers);
  assert.equal(pickupCodeMatch[0]?.orderId, 'order-1');

  const fuzzyNameMatch = buildLookupPrintRows('alice', orders, customers);
  assert.equal(fuzzyNameMatch[0]?.orderId, 'order-1');
  assert.ok(orderMatch[0].matchScore > fuzzyNameMatch[0].matchScore);
});

test('marks seller packet availability only when the order has a seller', () => {
  const rows = buildLookupPrintRows('alice', orders, customers);

  assert.equal(rows[0].canPrintSellerPacket, true);
  assert.equal(buildLookupPrintRows('bob', orders, customers)[0].canPrintSellerPacket, false);
});

test('returns an empty list for no-match searches without suggesting walk-up recovery', () => {
  assert.deepEqual(buildLookupPrintRows('no-such-order', orders, customers), []);
});

test('matches letter filters by customer last name and supports the # bucket', () => {
  const alphaCustomer = customers.get('customer-1');
  assert.equal(matchesLookupPrintLetterFilter(alphaCustomer!, 'S'), true);
  assert.equal(matchesLookupPrintLetterFilter(alphaCustomer!, 'A'), false);

  const numericCustomer: Customer = {
    id: 'customer-3',
    firstName: null,
    lastName: null,
    displayName: '3M Holdings',
    phone: null,
    email: null,
    pickupCode: 'NUM-300',
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  assert.equal(matchesLookupPrintLetterFilter(numericCustomer, '#'), true);
  assert.equal(matchesLookupPrintLetterFilter(numericCustomer, 'M'), false);
});

test('builds letter rows sorted by customer last name', () => {
  const rows = buildLookupPrintLetterRows(orders, customers);

  assert.deepEqual(rows.map((row) => row.orderId), ['order-2', 'order-1']);
});

test('builds the default station list from recent active orders only', () => {
  const rows = buildLookupPrintRecentRows(recentOrders, customers, 5);

  assert.deepEqual(rows.map((row) => row.orderId), ['order-4', 'order-3']);
  assert.equal(rows[0].status, 'Open');
  assert.equal(rows[1].status, 'InProgress');
});
