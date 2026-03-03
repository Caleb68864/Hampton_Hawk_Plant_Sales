import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '@/api/reports.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import type { DashboardMetrics, LowInventoryItem, ProblemOrder } from '@/types/reports.js';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowInventory, setLowInventory] = useState<LowInventoryItem[]>([]);
  const [problemOrders, setProblemOrders] = useState<ProblemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportsApi.dashboardMetrics(),
      reportsApi.lowInventory(),
      reportsApi.problemOrders(),
    ])
      .then(([m, li, po]) => {
        setMetrics(m);
        setLowInventory(li);
        setProblemOrders(po);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!metrics) return <ErrorBanner message={error ?? 'Failed to load dashboard'} />;

  const completionPct = (metrics.totalOrders ?? 0) > 0
    ? Math.round(((metrics.completedOrders ?? 0) / metrics.totalOrders) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Orders" value={metrics.totalOrders} />
        <MetricCard label="Open Orders" value={metrics.openOrders} />
        <MetricCard label="Completed" value={metrics.completedOrders} />
        <MetricCard label="Customers" value={metrics.totalCustomers} />
        <MetricCard label="Sellers" value={metrics.totalSellers} />
      </div>

      {/* Sale Progress Meter */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Sale Progress</h2>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-gray-600">{metrics.completedOrders} of {metrics.totalOrders} orders completed</p>
          <p className="text-sm font-medium text-gray-700">{completionPct}%</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${completionPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(completionPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Inventory */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Low Inventory ({metrics.lowInventoryCount})</h2>
            <Link to="/inventory" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          {lowInventory.length === 0 ? (
            <p className="text-sm text-gray-500">No low inventory items</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {lowInventory.slice(0, 10).map((item) => (
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
        </div>

        {/* Problem Orders */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Problem Orders ({metrics.problemOrderCount})</h2>
            <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          {problemOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No problem orders</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {problemOrders.slice(0, 10).map((o) => (
                <Link key={o.orderId} to={`/orders/${o.orderId}`} className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-1">
                  <div>
                    <p className="text-sm text-gray-900">{o.orderNumber} - {o.customerDisplayName}</p>
                    {o.issueDescription && <p className="text-xs text-amber-600">{o.issueDescription}</p>}
                  </div>
                  <StatusChip status={o.status as 'Open' | 'InProgress' | 'Complete' | 'Cancelled'} hasIssue={o.hasIssue} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink to="/orders/new" label="New Order" />
          <QuickLink to="/walkup/new" label="Walk-Up Order" />
          <QuickLink to="/pickup" label="Pickup Station" />
          <QuickLink to="/imports" label="Import Data" />
          <QuickLink to="/reports" label="Reports" />
          <QuickLink to="/settings" label="Settings" />
        </div>
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

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-4 py-2 text-sm font-medium text-hawk-700 bg-hawk-50 border border-hawk-200 rounded-md hover:bg-hawk-100"
    >
      {label}
    </Link>
  );
}
