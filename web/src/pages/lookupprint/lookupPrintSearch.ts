import type { Customer } from '../../types/customer.js';
import type { Order } from '../../types/order.js';

export interface LookupPrintSearchRow {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  pickupCode: string | null;
  sellerId: string | null;
  sellerName: string | null;
  status: Order['status'];
  matchScore: number;
  canPrintSellerPacket: boolean;
}

const ACTIVE_ORDER_STATUSES: ReadonlyArray<Order['status']> = ['Open', 'InProgress'];

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getCustomerBrowseKey(customer: Customer | undefined, fallbackName: string): string {
  const lastName = customer?.lastName?.trim();
  if (lastName) {
    return lastName;
  }

  const displayName = customer?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  return fallbackName.trim();
}

function toLookupPrintRow(order: Order, customer: Customer | undefined, matchScore: number): LookupPrintSearchRow {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: customer?.displayName ?? order.customerDisplayName,
    pickupCode: customer?.pickupCode ?? null,
    sellerId: order.sellerId,
    sellerName: order.sellerDisplayName,
    status: order.status,
    matchScore,
    canPrintSellerPacket: Boolean(order.sellerId),
  };
}

function getMatchScore(query: string, order: Order, customer: Customer | undefined): number {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return 0;
  }

  const orderNumber = order.orderNumber.toLowerCase();
  const customerName = (customer?.displayName ?? order.customerDisplayName).toLowerCase();
  const pickupCode = customer?.pickupCode?.toLowerCase() ?? '';

  if (orderNumber === normalizedQuery) return 300;
  if (pickupCode && pickupCode === normalizedQuery) return 280;
  if (customerName === normalizedQuery) return 260;
  if (orderNumber.startsWith(normalizedQuery)) return 220;
  if (customerName.startsWith(normalizedQuery)) return 180;
  if (pickupCode.startsWith(normalizedQuery)) return 160;
  if (orderNumber.includes(normalizedQuery)) return 150;
  if (customerName.includes(normalizedQuery)) return 130;
  if (pickupCode.includes(normalizedQuery)) return 120;
  return 0;
}

export function matchesLookupPrintLetterFilter(customer: Customer, letter: string | null): boolean {
  if (!letter) {
    return true;
  }

  const browseKey = getCustomerBrowseKey(customer, customer.displayName).trim();
  if (!browseKey) {
    return false;
  }

  const initial = browseKey[0].toUpperCase();
  if (letter === '#') {
    return !/^[A-Z]$/.test(initial);
  }

  return initial === letter.toUpperCase();
}

export function buildLookupPrintRows(
  query: string,
  orders: Order[],
  customersById: Map<string, Customer>,
): LookupPrintSearchRow[] {
  const normalizedQuery = normalizeQuery(query);

  return orders
    .map((order) => {
      const customer = customersById.get(order.customerId);
      const matchScore = getMatchScore(normalizedQuery, order, customer);

      return toLookupPrintRow(order, customer, matchScore);
    })
    .filter((row) => normalizedQuery.length === 0 || row.matchScore > 0)
    .sort((left, right) => {
      if (left.matchScore !== right.matchScore) {
        return right.matchScore - left.matchScore;
      }

      const customerComparison = left.customerName.localeCompare(right.customerName);
      if (customerComparison !== 0) {
        return customerComparison;
      }

      return left.orderNumber.localeCompare(right.orderNumber);
    });
}

export function buildLookupPrintLetterRows(
  orders: Order[],
  customersById: Map<string, Customer>,
): LookupPrintSearchRow[] {
  return orders
    .map((order) => {
      const customer = customersById.get(order.customerId);
      return {
        row: toLookupPrintRow(order, customer, 0),
        browseKey: getCustomerBrowseKey(customer, order.customerDisplayName).toLowerCase(),
      };
    })
    .sort((left, right) => {
      const browseComparison = left.browseKey.localeCompare(right.browseKey);
      if (browseComparison !== 0) {
        return browseComparison;
      }

      const customerComparison = left.row.customerName.localeCompare(right.row.customerName);
      if (customerComparison !== 0) {
        return customerComparison;
      }

      return left.row.orderNumber.localeCompare(right.row.orderNumber);
    })
    .map(({ row }) => row);
}

export function buildLookupPrintRecentRows(
  orders: Order[],
  customersById: Map<string, Customer>,
  limit = 12,
): LookupPrintSearchRow[] {
  return orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .sort((left, right) => {
      const createdAtComparison = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (!Number.isNaN(createdAtComparison) && createdAtComparison !== 0) {
        return createdAtComparison;
      }

      const statusPriority = (status: Order['status']) => (status === 'Open' ? 2 : status === 'InProgress' ? 1 : 0);
      const statusComparison = statusPriority(right.status) - statusPriority(left.status);
      if (statusComparison !== 0) {
        return statusComparison;
      }

      return left.orderNumber.localeCompare(right.orderNumber);
    })
    .slice(0, limit)
    .map((order) => toLookupPrintRow(order, customersById.get(order.customerId), 0));
}
