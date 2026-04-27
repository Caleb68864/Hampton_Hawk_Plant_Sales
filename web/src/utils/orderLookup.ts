import type { Order } from '../types/order.js';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const SCANNER_SETTLE_MS = 120;
const MAX_SCANNER_INTERVAL_MS = 45;
const MAX_SCANNER_BURST_INTERVAL_MS = 60;
const MIN_SCANNER_CHARACTERS = 6;
const MIN_SCANNER_INTERVALS = 3;

export type LookupSubmitSource = 'enter' | 'scanner-auto' | 'manual-button';

export interface ScannerAutoSubmitCandidate {
  value: string;
  intervalsMs: number[];
}

export function normalizeOrderLookupValue(value: string): string {
  const cleaned = value
    .replace(CONTROL_CHARACTERS, '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

  // Order barcodes encode as "OR" + 10-digit zero-padded order number. Strip the prefix and
  // leading zeros so a scanned "OR0000001001" resolves the same way a typed "1001" would.
  const barcodeMatch = /^OR(\d{1,10})$/.exec(cleaned);
  if (barcodeMatch) {
    return barcodeMatch[1].replace(/^0+/, '') || '0';
  }
  return cleaned;
}

export function looksLikeOrderNumberLookup(value: string): boolean {
  const normalizedValue = normalizeOrderLookupValue(value);
  return normalizedValue.length >= 6 && /\d/.test(normalizedValue);
}

// SS-13: Pick-list barcode detection. Buyer ("PLB-") and student/seller
// ("PLS-") prefixes signal the lookup field should create a scan session
// rather than navigate to a single order. Match a 4+ char alphanumeric body
// after the prefix.
const BUYER_PICKLIST_PATTERN = /^PLB-[A-Z0-9]{4,}$/;
const STUDENT_PICKLIST_PATTERN = /^PLS-[A-Z0-9]{4,}$/;

export function looksLikeBuyerPicklist(value: string): boolean {
  const normalizedValue = normalizeOrderLookupValue(value);
  return BUYER_PICKLIST_PATTERN.test(normalizedValue);
}

export function looksLikeStudentPicklist(value: string): boolean {
  const normalizedValue = normalizeOrderLookupValue(value);
  return STUDENT_PICKLIST_PATTERN.test(normalizedValue);
}

export function looksLikePicklistBarcode(value: string): boolean {
  return looksLikeBuyerPicklist(value) || looksLikeStudentPicklist(value);
}

export function isExactOrderNumberMatch(orderNumber: string, submittedValue: string): boolean {
  return normalizeOrderLookupValue(orderNumber) === normalizeOrderLookupValue(submittedValue);
}

export function findExactOrderNumberMatches(submittedValue: string, orders: Order[]): Order[] {
  const normalizedSubmitted = normalizeOrderLookupValue(submittedValue);
  return orders.filter((order) =>
    normalizeOrderLookupValue(order.orderNumber) === normalizedSubmitted ||
    (order.barcode != null && normalizeOrderLookupValue(order.barcode) === normalizedSubmitted),
  );
}

export function shouldAutoSubmitScannerValue(candidate: ScannerAutoSubmitCandidate): boolean {
  const normalizedValue = normalizeOrderLookupValue(candidate.value);
  if (normalizedValue.length < MIN_SCANNER_CHARACTERS) {
    return false;
  }

  if (candidate.intervalsMs.length < MIN_SCANNER_INTERVALS) {
    return false;
  }

  const boundedIntervals = candidate.intervalsMs.slice(-6);
  if (boundedIntervals.some((interval) => interval <= 0 || interval > MAX_SCANNER_BURST_INTERVAL_MS)) {
    return false;
  }

  const averageInterval = boundedIntervals.reduce((sum, interval) => sum + interval, 0) / boundedIntervals.length;
  return averageInterval <= MAX_SCANNER_INTERVAL_MS;
}

export function getScannerSettleDelayMs(): number {
  return SCANNER_SETTLE_MS;
}
