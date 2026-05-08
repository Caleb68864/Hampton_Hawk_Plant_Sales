import type { Order } from '../../types/order.js';
import {
  findExactOrderNumberMatches,
  looksLikeOrderNumberLookup,
  looksLikePicklistBarcode,
  normalizeOrderLookupValue,
} from '../../utils/orderLookup.js';

/**
 * Classifies a raw scanned/typed value for the mobile pickup workflow.
 *
 * - `"order-number"`: value resembles an order number / order barcode (REUSE
 *   `looksLikeOrderNumberLookup` from `utils/orderLookup.ts`).
 * - `"item-barcode"`: value resembles a pick-list / item-shaped barcode
 *   (`PLB-` / `PLS-` / generic plant SKU prefix `PL-`).
 * - `"ambiguous"`: value is too short, empty, or otherwise can't be classified
 *   confidently.
 *
 * Pure helper. No React, no API, no scanner imports.
 */
export type MobileScanInputClassification = 'order-number' | 'item-barcode' | 'ambiguous';

const ITEM_BARCODE_PATTERN = /^(PL|PLB|PLS)-[A-Z0-9]{2,}$/;

export function classifyMobileScanInput(value: string): MobileScanInputClassification {
  if (typeof value !== 'string') return 'ambiguous';
  const normalized = normalizeOrderLookupValue(value);
  if (!normalized) return 'ambiguous';

  // Pick-list barcodes are item-shaped (PLB-/PLS-).
  if (looksLikePicklistBarcode(value)) return 'item-barcode';

  // Generic plant-SKU/item-shaped barcode (e.g., "PL-12345").
  if (ITEM_BARCODE_PATTERN.test(normalized)) return 'item-barcode';

  if (looksLikeOrderNumberLookup(value)) return 'order-number';

  return 'ambiguous';
}

/**
 * Returns the single exact-matching order from a candidate list.
 * - 0 matches → `null`
 * - 1 match → that order
 * - 2+ matches → `null` (caller is responsible for showing a list)
 */
export function selectExactOrderMatch(orders: Order[], value: string): Order | null {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  const matches = findExactOrderNumberMatches(value, orders);
  if (matches.length === 1) return matches[0];
  return null;
}
