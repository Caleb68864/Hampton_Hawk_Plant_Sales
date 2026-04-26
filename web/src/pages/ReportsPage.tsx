import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import type { DashboardMetrics } from '@/types/reports.js';

const EMPTY_METRICS: DashboardMetrics = {
  totalOrders: 0,
  openOrders: 0,
  completedOrders: 0,
  totalCustomers: 0,
  totalSellers: 0,
  lowInventoryCount: 0,
  problemOrderCount: 0,
  ordersByStatus: {},
  totalItemsOrdered: 0,
  totalItemsFulfilled: 0,
  saleProgressPercent: 0,
};

const CHART_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
];

interface ReportCardLink {
  to: string;
  eyebrow: string;
  title: string;
  description: string;
}

interface ReportCategory {
  heading: string;
  eyebrow: string;
  cards: ReportCardLink[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    heading: 'Sales Breakdowns',
    eyebrow: 'Sales',
    cards: [
      {
        to: '/reports/sales-by-seller',
        eyebrow: 'Sales',
        title: 'Sales by Seller',
        description: 'Per-seller order count, units, and revenue (ordered vs fulfilled).',
      },
      {
        to: '/reports/sales-by-customer',
        eyebrow: 'Sales',
        title: 'Sales by Customer',
        description: 'Per-customer order totals and revenue breakdown.',
      },
      {
        to: '/reports/sales-by-plant',
        eyebrow: 'Sales',
        title: 'Sales by Plant',
        description: 'Per-plant units sold and revenue (ordered vs fulfilled).',
      },
      {
        to: '/reports/daily-sales',
        eyebrow: 'Sales',
        title: 'Daily Sales',
        description: 'Day-by-day orders, items, revenue, and walk-up vs preorder split.',
      },
    ],
  },
  {
    heading: 'Operations',
    eyebrow: 'Ops',
    cards: [
      {
        to: '/reports/status-funnel',
        eyebrow: 'Ops',
        title: 'Status Funnel',
        description: 'Orders by status with percent of total — Draft excluded.',
      },
      {
        to: '/reports/outstanding-aging',
        eyebrow: 'Ops',
        title: 'Outstanding Aging',
        description: 'Open + in-progress orders bucketed by hours since created.',
      },
    ],
  },
  {
    heading: 'Money',
    eyebrow: 'Money',
    cards: [
      {
        to: '/reports/payment-breakdown',
        eyebrow: 'Money',
        title: 'Payment Breakdown',
        description: 'Orders, revenue, and average order grouped by payment method.',
      },
      {
        to: '/reports/walkup-vs-preorder',
        eyebrow: 'Money',
        title: 'WalkUp vs Preorder',
        description: 'Channel split with walk-up share, item counts, and revenue.',
      },
    ],
  },
  {
    heading: 'Inventory',
    eyebrow: 'Inventory',
    cards: [
      {
        to: '/reports/top-movers',
        eyebrow: 'Inventory',
        title: 'Top Movers',
        description: 'Most-ordered plants by quantity, with fulfillment counts.',
      },
      {
        to: '/reports/leftover-inventory',
        eyebrow: 'Inventory',
        title: 'Leftover Inventory',
        description: 'On-hand units that have not yet been claimed by an order.',
      },
    ],
  },
];

export function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .dashboardMetrics()
      .then((result) => setMetrics(result))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load report metrics.'))
      .finally(() => setLoading(false));
  }, []);

  const statusRows = useMemo(() => {
    const rows = Object.entries(metrics.ordersByStatus ?? {})
      .map(([status, count]) => ({ status, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count);

    if (rows.length > 0) return rows;

    return [
      { status: 'Open', count: metrics.openOrders },
      { status: 'Complete', count: metrics.completedOrders },
    ].filter((row) => row.count > 0);
  }, [metrics]);

  const fulfillmentRate = metrics.totalItemsOrdered > 0
    ? Math.round((metrics.totalItemsFulfilled / metrics.totalItemsOrdered) * 100)
    : 0;

  const completionRate = metrics.totalOrders > 0
    ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100)
    : 0;

  if (loading) return <LoadingSpinner />;

  const noReportData =
    metrics.totalOrders === 0 &&
    metrics.totalCustomers === 0 &&
    metrics.totalSellers === 0 &&
    statusRows.length === 0;

  return (
    <div className="paper-grain space-y-6 relative">
      <div className="relative z-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading level={1} eyebrow="Insights">Reports</SectionHeading>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {noReportData && !error && (
          <BotanicalEmptyState
            title="No report data yet"
            description="Once orders start flowing in, dashboards, charts, and breakdowns will appear here."
          />
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Total Orders" value={metrics.totalOrders} />
          <MetricCard label="Open Orders" value={metrics.openOrders} />
          <MetricCard label="Completed" value={metrics.completedOrders} />
          <MetricCard label="Items Ordered" value={metrics.totalItemsOrdered} />
          <MetricCard label="Items Fulfilled" value={metrics.totalItemsFulfilled} />
          <MetricCard label="Customers" value={metrics.totalCustomers} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-hawk-200 bg-white p-6 xl:col-span-2 joy-shadow-plum">
            <div className="mb-4">
              <SectionHeading level={3}>Order Status Distribution</SectionHeading>
            </div>
            {statusRows.length === 0 ? (
              <p className="text-sm text-gray-500">No order status data available.</p>
            ) : (
              <div className="space-y-4">
                {statusRows.map((row, index) => {
                  const percentage = metrics.totalOrders > 0 ? Math.round((row.count / metrics.totalOrders) * 100) : 0;
                  return (
                    <div key={row.status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <p className="font-medium text-gray-700">{formatStatus(row.status)}</p>
                        <p className="text-gray-500">{row.count.toLocaleString()} ({percentage}%)</p>
                      </div>
                      <div className="h-3 w-full rounded-full bg-gray-100">
                        <div
                          className={`h-3 rounded-full ${CHART_COLORS[index % CHART_COLORS.length]}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
            <div className="mb-4">
              <SectionHeading level={3}>Performance Snapshot</SectionHeading>
            </div>
            <ProgressRing label="Order Completion" value={completionRate} colorClass="stroke-blue-500" />
            <div className="my-6 border-t border-gray-100" />
            <ProgressRing label="Line Fulfillment" value={fulfillmentRate} colorClass="stroke-green-500" />
          </section>
        </div>

        {REPORT_CATEGORIES.map((category) => (
          <section key={category.heading} className="space-y-3">
            <SectionHeading level={3} eyebrow={category.eyebrow}>
              {category.heading}
            </SectionHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {category.cards.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className="group block rounded-2xl border border-hawk-200 bg-white p-5 joy-shadow-plum transition-shadow hover:border-gold-300 hover:shadow-[0_12px_28px_-12px_rgba(184,129,26,0.45)]"
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.24em] text-hawk-700"
                    style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
                  >
                    {card.eyebrow}
                  </p>
                  <h4
                    className="mt-1 text-xl text-hawk-900 group-hover:text-hawk-950"
                    style={{
                      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                      fontVariationSettings: "'opsz' 144, 'wght' 600",
                    }}
                  >
                    {card.title}
                  </h4>
                  <p className="mt-2 text-sm text-hawk-600">{card.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-hawk-200 bg-white p-4 joy-shadow-plum">
      <p
        className="text-xs font-bold uppercase tracking-[0.24em] text-hawk-700"
        style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-3xl text-hawk-900"
        style={{
          fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
          fontVariationSettings: "'opsz' 144, 'wght' 600",
        }}
      >
        {(value ?? 0).toLocaleString()}
      </p>
    </div>
  );
}

function ProgressRing({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
        <circle cx="56" cy="56" r={radius} className="fill-none stroke-gray-200" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          className={`fill-none ${colorClass}`}
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 56 56)"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{pct}%</p>
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  if (!status) return 'Unknown';
  return status
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
