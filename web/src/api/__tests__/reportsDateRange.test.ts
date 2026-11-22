import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../client.js', () => ({ get: (...args: unknown[]) => get(...args) }));

const { reportsApi } = await import('../reports.js');

// Expectations are built with the local Date constructor, so they hold in any
// timezone the suite runs in: the range is local days, not UTC days.
const startOf = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();

describe('report date ranges', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({});
  });

  it.each([
    ['getDailySales', '/reports/daily-sales'],
    ['getPaymentBreakdown', '/reports/payment-breakdown'],
    ['getWalkupVsPreorder', '/reports/walkup-vs-preorder'],
  ] as const)('%s sends the picked end date inclusively, as local day bounds', async (method, url) => {
    await reportsApi[method]('2026-05-01', '2026-05-09');
    const [calledUrl, params] = get.mock.calls[0];
    expect(calledUrl).toBe(url);
    expect(params.from).toBe(startOf(2026, 5, 1));
    // The API's `to` is exclusive; sending "2026-05-09" dropped that whole day.
    expect(params.to).toBe(startOf(2026, 5, 10));
  });

  it('daily sales sends the browser timezone so days are bucketed locally', async () => {
    await reportsApi.getDailySales('2026-05-01', '2026-05-09');
    expect(get.mock.calls[0][1].timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('an open range sends no bounds', async () => {
    await reportsApi.getPaymentBreakdown(undefined, undefined);
    expect(get.mock.calls[0][1]).toEqual({});
  });
});
