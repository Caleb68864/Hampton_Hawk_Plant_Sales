// Report date filters are picked as calendar dates in the volunteer's own
// timezone, but the API compares them against UTC timestamps, with `to` as an
// exclusive bound. Sending the bare "YYYY-MM-DD" meant UTC midnight, so
// choosing today as the end date dropped today's sales (in US timezones,
// until the evening), and the start date was off by the UTC offset too.

/** Today's date (or `d`'s) as YYYY-MM-DD in local time, not UTC. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `days` before `d` as a local YYYY-MM-DD. */
export function localDateDaysAgo(days: number, d: Date = new Date()): string {
  const past = new Date(d.getFullYear(), d.getMonth(), d.getDate() - days);
  return localDateString(past);
}

function localMidnight(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Query params for a report range picked as local dates, both inclusive:
 * `from` becomes the start of that local day, `to` the start of the local day
 * after it (the API's exclusive bound), as ISO instants.
 */
export function reportRangeParams(from?: string, to?: string): Record<string, string> {
  const params: Record<string, string> = {};
  const start = from ? localMidnight(from) : null;
  if (start) params.from = start.toISOString();
  const end = to ? localMidnight(to) : null;
  if (end) {
    end.setDate(end.getDate() + 1);
    params.to = end.toISOString();
  }
  return params;
}

/** The browser's IANA timezone (e.g. America/Chicago), if it reports one. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * A calendar date from the API ("2026-05-09", a DateOnly) for display. Parsed
 * as a local date: `new Date("2026-05-09")` is UTC midnight, which US
 * timezones render as the day before.
 */
export function formatCalendarDate(value: string): string {
  if (!value) return '';
  const start = localMidnight(value.slice(0, 10));
  if (!start) return value;
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
