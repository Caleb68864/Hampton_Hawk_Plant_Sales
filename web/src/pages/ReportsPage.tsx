import { useEffect, useState } from 'react';
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Orders" value={metrics.totalOrders} />
        <MetricCard label="Open Orders" value={metrics.openOrders} />
        <MetricCard label="Completed" value={metrics.completedOrders} />
        <MetricCard label="Low Inventory" value={metrics.lowInventoryCount} />
        <MetricCard label="Problem Orders" value={metrics.problemOrderCount} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Low Inventory</h2>
            <Link to="/inventory" className="text-sm text-blue-600 hover:text-blue-700">Inventory</Link>
          </div>
          {lowInventory.length === 0 ? (
            <p className="text-sm text-gray-500">No low inventory items.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {lowInventory.map((item) => (
                <div key={item.plantCatalogId} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-gray-900">{item.plantName}</p>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {item.onHandQty} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Problem Orders</h2>
            <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-700">Orders</Link>
          </div>
          {problemOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No problem orders.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {problemOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block rounded px-1 py-2 hover:bg-gray-50"
                >
                  <p className="text-sm text-gray-900">{order.orderNumber} - {order.customerName}</p>
                  <p className="text-xs text-amber-600">Status: {order.status} • Lines: {order.lineCount}</p>
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{(value ?? 0).toLocaleString()}</p>
    </div>
  );
}
