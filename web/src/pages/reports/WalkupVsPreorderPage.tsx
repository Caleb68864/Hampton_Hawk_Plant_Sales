import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { ChannelMetrics, WalkupVsPreorderResponse } from '@/types/reports.js';

const EMPTY_CHANNEL: ChannelMetrics = {
  orderCount: 0,
  itemCount: 0,
  revenue: 0,
  averageOrder: 0,
};

const EMPTY_RESPONSE: WalkupVsPreorderResponse = {
  walkUp: EMPTY_CHANNEL,
  preorder: EMPTY_CHANNEL,
  walkUpRatio: 0,
};

export function WalkupVsPreorderPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<WalkupVsPreorderResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .getWalkupVsPreorder(from || undefined, to || undefined)
      .then((result) => setData(result))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load walk-up vs preorder report.'))
      .finally(() => setLoading(false));
  }, [from, to, refreshTick]);

  const totalOrders = data.walkUp.orderCount + data.preorder.orderCount;
  const ratioPct = Math.round(data.walkUpRatio * 100);

  async function handleCopySummary() {
    const lines = [
      `Walk-up vs Preorder${from || to ? ` (${from || 'start'} → ${to || 'now'})` : ''}`,
      `Walk-up ratio: ${ratioPct}%`,
      `Walk-up: ${data.walkUp.orderCount} orders, ${data.walkUp.itemCount} items, ${formatCurrency(data.walkUp.revenue)} revenue, ${formatCurrency(data.walkUp.averageOrder)} avg`,
      `Preorder: ${data.preorder.orderCount} orders, ${data.preorder.itemCount} items, ${formatCurrency(data.preorder.revenue)} revenue, ${formatCurrency(data.preorder.averageOrder)} avg`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setError('Could not copy summary to clipboard.');
    }
  }

  const actions = (
    <>
      <TouchButton variant="ghost" onClick={() => setRefreshTick((n) => n + 1)}>
        Refresh
      </TouchButton>
      <TouchButton variant="gold" onClick={handleCopySummary}>
        {copyState === 'copied' ? 'Copied!' : 'Copy summary'}
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
    <JoyPageShell title="WalkUp vs Preorder" eyebrow="Insights" actions={actions}>
      <section className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 rounded-md border border-hawk-200 px-2 py-1 text-sm"
            />
          </label>
          <p className="ml-auto text-xs text-hawk-600">{from || to ? 'Filtered range' : 'All time'}</p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner />
      ) : totalOrders === 0 ? (
        <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
          <BotanicalEmptyState
            title="No channel data yet"
            description="Walk-up and preorder splits will appear here as orders flow in."
          />
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-gold-300 bg-gradient-to-br from-gold-50 to-white p-6 joy-shadow-plum">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-hawk-700">Walk-up share</p>
            <p
              className="mt-1 text-5xl text-hawk-900"
              style={{
                fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                fontVariationSettings: "'opsz' 144, 'wght' 600",
              }}
            >
              {ratioPct}%
            </p>
            <p className="mt-1 text-sm text-hawk-700">
              of {totalOrders.toLocaleString()} non-draft orders were walk-up.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChannelCard title="WalkUp" eyebrow="Channel" metrics={data.walkUp} />
            <ChannelCard title="Preorder" eyebrow="Channel" metrics={data.preorder} />
          </div>
        </>
      )}
    </JoyPageShell>
  );
}

function ChannelCard({
  title,
  eyebrow,
  metrics,
}: {
  title: string;
  eyebrow: string;
  metrics: ChannelMetrics;
}) {
  return (
    <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
      <SectionHeading level={3} eyebrow={eyebrow}>
        {title}
      </SectionHeading>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm tabular-nums">
        <Stat label="Orders" value={metrics.orderCount.toLocaleString()} />
        <Stat label="Items" value={metrics.itemCount.toLocaleString()} />
        <Stat label="Revenue" value={formatCurrency(metrics.revenue)} accent />
        <Stat label="Avg Order" value={formatCurrency(metrics.averageOrder)} />
      </dl>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-hawk-700">{label}</dt>
      <dd
        className={`mt-1 text-2xl ${accent ? 'text-emerald-700' : 'text-hawk-900'}`}
        style={{
          fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
          fontVariationSettings: "'opsz' 144, 'wght' 600",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
