import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Orders" value={metrics.totalOrders} />
        <MetricCard label="Open Orders" value={metrics.openOrders} />
        <MetricCard label="Completed" value={metrics.completedOrders} />
        <MetricCard label="Items Ordered" value={metrics.totalItemsOrdered} />
        <MetricCard label="Items Fulfilled" value={metrics.totalItemsFulfilled} />
        <MetricCard label="Customers" value={metrics.totalCustomers} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-6 xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Order Status Distribution</h2>
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

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Performance Snapshot</h2>
          <ProgressRing label="Order Completion" value={completionRate} colorClass="stroke-blue-500" />
          <div className="my-6 border-t border-gray-100" />
          <ProgressRing label="Line Fulfillment" value={fulfillmentRate} colorClass="stroke-green-500" />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Critical Inventory Risk</h2>
            <Link to="/inventory" className="text-sm text-blue-600 hover:text-blue-700">Inventory</Link>
          </div>
          {topLowInventory.length === 0 ? (
            <p className="text-sm text-gray-500">No low inventory items.</p>
          ) : (
            <div className="space-y-3">
              {topLowInventory.map((item) => {
                const dangerPct = Math.max(0, Math.min(100, (item.onHandQty / 25) * 100));
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

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Oldest Problem Orders</h2>
            <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-700">Orders</Link>
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
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{(value ?? 0).toLocaleString()}</p>
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
