import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { OutstandingAgingBucket } from '@/types/reports.js';

export function OutstandingAgingPage() {
  const [buckets, setBuckets] = useState<OutstandingAgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getOutstandingAging()
      .then((result) => setBuckets(result.buckets))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load outstanding aging.'))
      .finally(() => setLoading(false));
  }, [refreshTick]);

  const totalCount = useMemo(() => buckets.reduce((sum, b) => sum + b.count, 0), [buckets]);
  const oldest = useMemo(() => {
    return buckets.reduce<OutstandingAgingBucket | null>(
      (acc, b) => (b.oldestAgeHours > (acc?.oldestAgeHours ?? -1) ? b : acc),
      null,
    );
  }, [buckets]);

  const actions = (
    <>
      <TouchButton variant="ghost" onClick={() => setRefreshTick((n) => n + 1)}>
        Refresh
      </TouchButton>
      <Link
        to="/reports"
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Back to Reports
      </Link>
    </>
  );

  return (
    <JoyPageShell title="Outstanding Aging" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <p className="text-sm text-hawk-700">
          Open and in-progress orders bucketed by age (hours since created).
        </p>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {oldest && oldest.count > 0 && (
        <section
          className={`rounded-2xl border p-4 joy-shadow-plum ${
            oldest.oldestAgeHours > 168
              ? 'border-red-300 bg-red-50'
              : oldest.oldestAgeHours > 72
                ? 'border-amber-300 bg-amber-50'
                : 'border-hawk-200 bg-white'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">Oldest bucket</p>
          <p
            className="mt-1 text-2xl text-hawk-900"
            style={{
              fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              fontVariationSettings: "'opsz' 144, 'wght' 600",
            }}
          >
            {oldest.bucket} • {oldest.oldestAgeHours.toFixed(1)} hrs
          </p>
          <p className="mt-1 text-sm text-hawk-700">
            {oldest.count.toLocaleString()} order{oldest.count === 1 ? '' : 's'} sit in this bucket.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        {loading ? (
          <LoadingSpinner />
        ) : totalCount === 0 ? (
          <BotanicalEmptyState
            title="No open or in-progress orders"
            description="Aging buckets will fill in as orders come in and stay open."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm tabular-nums">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Bucket</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Count</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Oldest (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {buckets.map((b) => (
                  <tr key={b.bucket}>
                    <td className="px-3 py-2 text-gray-900">{b.bucket}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{b.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {b.count === 0 ? '—' : b.oldestAgeHours.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </JoyPageShell>
  );
}
