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
  return value
    .replace(CONTROL_CHARACTERS, '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function looksLikeOrderNumberLookup(value: string): boolean {
  const normalizedValue = normalizeOrderLookupValue(value);
  return normalizedValue.length >= 6 && /\d/.test(normalizedValue);
}

export function isExactOrderNumberMatch(orderNumber: string, submittedValue: string): boolean {
  return normalizeOrderLookupValue(orderNumber) === normalizeOrderLookupValue(submittedValue);
}

export function findExactOrderNumberMatches(submittedValue: string, orders: Order[]): Order[] {
  return orders.filter((order) => isExactOrderNumberMatch(order.orderNumber, submittedValue));
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
