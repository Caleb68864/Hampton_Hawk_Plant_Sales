import type { Order } from '../../types/order.js';
import type { CurrentUser } from '../../types/auth.js';
import { findExactOrderNumberMatches } from '../../utils/orderLookup.js';

/**
 * Pure helpers for the mobile order lookup workflow.
 *
 * No React, no API, no scanner imports. Safe to test in isolation.
 *
 * `partitionLookupResults` uses `findExactOrderNumberMatches` to split a
 * server-provided order list into:
 *   - exact: the single, unambiguous order-number match (or null)
 *   - ambiguous: 2+ exact-number matches (caller must show a list)
 *   - broad: zero exact-number matches but the search returned other orders
 *
 * `canScanIntoOrders` returns true only for users who can fulfill orders
 * (`Pickup` or `Admin`). `LookupPrint`-only users never get scan-into-order
 * affordances per spec REQ-006 / REQ-024.
 */
export interface LookupPartition {
  exact: Order | null;
  ambiguous: Order[];
  broad: Order[];
}

export function partitionLookupResults(
  orders: Order[],
  submittedValue: string,
): LookupPartition {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { exact: null, ambiguous: [], broad: [] };
  }

  const exactMatches = findExactOrderNumberMatches(submittedValue, orders);

  if (exactMatches.length === 1) {
    return { exact: exactMatches[0], ambiguous: [], broad: [] };
  }

  if (exactMatches.length >= 2) {
    return { exact: null, ambiguous: exactMatches, broad: [] };
  }

  // No exact match — surface the server's broad results for user selection.
  return { exact: null, ambiguous: [], broad: orders };
}

export function canScanIntoOrders(user: CurrentUser | null): boolean {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some((r) => r === 'Pickup' || r === 'Admin');
}
