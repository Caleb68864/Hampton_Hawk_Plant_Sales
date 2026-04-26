import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import type { DashboardMetrics, LowInventoryItem, ProblemOrder } from '@/types/reports.js';

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

export function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [lowInventory, setLowInventory] = useState<LowInventoryItem[]>([]);
  const [problemOrders, setProblemOrders] = useState<ProblemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      reportsApi.dashboardMetrics(),
      reportsApi.lowInventory(),
      reportsApi.problemOrders(),
    ])
      .then(([metricsResult, lowInventoryResult, problemOrdersResult]) => {
        if (metricsResult.status === 'fulfilled') {
          setMetrics(metricsResult.value);
        }

        if (lowInventoryResult.status === 'fulfilled') {
          setLowInventory(lowInventoryResult.value);
        }

        if (problemOrdersResult.status === 'fulfilled') {
          setProblemOrders(problemOrdersResult.value);
        }

        const firstFailure = [metricsResult, lowInventoryResult, problemOrdersResult]
          .find((r) => r.status === 'rejected');
        if (firstFailure && firstFailure.status === 'rejected') {
          const reason = firstFailure.reason;
          setError(reason instanceof Error ? reason.message : 'Some report data failed to load.');
        }
      })
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

  const topLowInventory = [...lowInventory]
    .sort((a, b) => a.onHandQty - b.onHandQty)
    .slice(0, 8);

  const oldestProblems = [...problemOrders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 8);

  if (loading) return <LoadingSpinner />;

  const noReportData =
    metrics.totalOrders === 0 &&
    metrics.totalCustomers === 0 &&
    metrics.totalSellers === 0 &&
    statusRows.length === 0 &&
    topLowInventory.length === 0 &&
    oldestProblems.length === 0;

  return (
    <div className="paper-grain space-y-6 relative">
      <div className="relative z-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading level={1} eyebrow="Insights">Reports</SectionHeading>
        <Link
          to="/reports/leftover-inventory"
          className="inline-flex items-center justify-center gap-2.5 min-h-11 min-w-11 px-5 py-3 rounded-xl text-sm font-semibold text-hawk-950 bg-gradient-to-b from-gold-300 to-gold-500 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_2px_0_var(--color-gold-800),0_12px_24px_-10px_rgba(184,129,26,0.6)] hover:brightness-105 transition-transform duration-100 ease-out active:translate-y-px"
          style={{ fontFamily: "var(--font-body), 'Manrope', system-ui, sans-serif" }}
        >
          Leftover Inventory Report
        </Link>
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

      <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
        <div className="mb-4">
          <SectionHeading level={3}>Sales Breakdowns</SectionHeading>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            to="/reports/sales-by-seller"
            className="block rounded-xl border border-hawk-200 bg-hawk-50/50 p-4 transition-shadow hover:border-gold-300 hover:bg-white hover:shadow-[0_8px_20px_-12px_rgba(184,129,26,0.45)]"
          >
            <p className="text-sm font-semibold text-gray-900">Sales by Seller</p>
            <p className="mt-1 text-xs text-gray-600">Per-seller order count, units, and revenue (ordered vs fulfilled).</p>
          </Link>
          <Link
            to="/reports/sales-by-customer"
            className="block rounded-xl border border-hawk-200 bg-hawk-50/50 p-4 transition-shadow hover:border-gold-300 hover:bg-white hover:shadow-[0_8px_20px_-12px_rgba(184,129,26,0.45)]"
          >
            <p className="text-sm font-semibold text-gray-900">Sales by Customer</p>
            <p className="mt-1 text-xs text-gray-600">Per-customer order totals and revenue breakdown.</p>
          </Link>
          <Link
            to="/reports/sales-by-plant"
            className="block rounded-xl border border-hawk-200 bg-hawk-50/50 p-4 transition-shadow hover:border-gold-300 hover:bg-white hover:shadow-[0_8px_20px_-12px_rgba(184,129,26,0.45)]"
          >
            <p className="text-sm font-semibold text-gray-900">Sales by Plant</p>
            <p className="mt-1 text-xs text-gray-600">Per-plant units sold and revenue (ordered vs fulfilled).</p>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
          <div className="mb-3 flex items-center justify-between">
            <SectionHeading level={3}>Critical Inventory Risk</SectionHeading>
            <Link to="/inventory" className="text-sm text-hawk-700 hover:text-hawk-900 font-medium">Inventory</Link>
          </div>
          {topLowInventory.length === 0 ? (
            <p className="text-sm text-gray-500">No low inventory items.</p>
          ) : (
            <div className="space-y-3">
              {topLowInventory.map((item) => {
                const riskCeilingQty = 25;
                const dangerPct = Math.max(0, Math.min(100, ((riskCeilingQty - item.onHandQty) / riskCeilingQty) * 100));
                return (
                  <div key={item.plantCatalogId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-medium text-gray-900">{item.plantName}</p>
                      <p className="text-red-600">{item.onHandQty} left</p>
                    </div>
                    <p className="mb-1 text-xs text-gray-500">{item.sku}</p>
                    <div className="h-2 w-full rounded-full bg-red-100">
                      <div className="h-2 rounded-full bg-red-500" style={{ width: `${dangerPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-hawk-200 bg-white p-6 joy-shadow-plum">
          <div className="mb-3 flex items-center justify-between">
            <SectionHeading level={3}>Oldest Problem Orders</SectionHeading>
            <Link to="/orders" className="text-sm text-hawk-700 hover:text-hawk-900 font-medium">Orders</Link>
          </div>
          {oldestProblems.length === 0 ? (
            <p className="text-sm text-gray-500">No problem orders.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {oldestProblems.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block rounded px-1 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-900">{order.orderNumber} - {order.customerName}</p>
                  <p className="text-xs text-amber-700">
                    {formatStatus(order.status)} • {order.lineCount} lines • Created {formatDate(order.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
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

function formatDate(isoDate: string): string {
  if (!isoDate) return 'Unknown';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
