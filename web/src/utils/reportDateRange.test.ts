import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarDate, localDateDaysAgo, localDateString, reportRangeParams } from './reportDateRange.ts';

// Pin a US timezone (node:test runs each file in its own process, and Node
// re-reads TZ when it is assigned), so a UTC-based implementation gives
// different answers here than a local one whatever the machine's zone is.
process.env.TZ = 'America/Chicago';

test('runs in a US timezone, or the checks below prove nothing', () => {
  assert.equal(new Date(2026, 4, 9).getTimezoneOffset(), 300);
});

test('localDateString is the local calendar date, not the UTC one', () => {
  // 8pm CDT on May 9 is already May 10 in UTC.
  const evening = new Date('2026-05-10T01:00:00Z');
  assert.equal(localDateString(evening), '2026-05-09');
  assert.equal(localDateDaysAgo(30, evening), '2026-04-09');
});

test('the end date is inclusive: to becomes the next local midnight', () => {
  assert.deepEqual(reportRangeParams('2026-05-09', '2026-05-09'), {
    from: '2026-05-09T05:00:00.000Z',
    to: '2026-05-10T05:00:00.000Z',
  });
});

test('a sale at 10am local on the end date falls inside the range', () => {
  const { from, to } = reportRangeParams('2026-05-09', '2026-05-09');
  const sale = Date.parse('2026-05-09T15:00:00Z');
  assert.ok(Date.parse(from) <= sale && sale < Date.parse(to));
});

test('blank or malformed dates send nothing', () => {
  assert.deepEqual(reportRangeParams('', undefined), {});
  assert.deepEqual(reportRangeParams('05/09/2026', 'nope'), {});
});

test('a DateOnly from the API is shown as that same day', () => {
  const shown = formatCalendarDate('2026-11-21');
  assert.equal(shown, new Date(2026, 10, 21).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  assert.equal(formatCalendarDate('not a date'), 'not a date');
});
