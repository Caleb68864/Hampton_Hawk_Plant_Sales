import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { OrderLinesTable } from '@/components/OrderLinesTable.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { ConfirmModal } from '@/components/shared/ConfirmModal.js';
import { useAdminAuth } from '@/hooks/useAdminAuth.js';
import type { Order } from '@/types/order.js';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requestAdminAuth } = useAdminAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    ordersApi
      .getById(id!)
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleForceComplete() {
    const auth = await requestAdminAuth();
    if (!auth) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await ordersApi.complete(id!, auth.pin, auth.reason);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete order');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReset() {
    const auth = await requestAdminAuth();
    if (!auth) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await ordersApi.reset(id!, auth.pin, auth.reason);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset order');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    setShowDelete(false);
    setActionLoading(true);
    try {
      await ordersApi.delete(id!);
      navigate('/orders', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete order');
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!order) return <ErrorBanner message={error ?? 'Order not found'} />;

  const totalOrdered = order.lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
  const totalFulfilled = order.lines.reduce((sum, l) => sum + l.qtyFulfilled, 0);
  const overallPct = totalOrdered > 0 ? Math.round((totalFulfilled / totalOrdered) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Order {order.orderNumber}</h1>
          <StatusChip status={order.status} hasIssue={order.hasIssue} />
        </div>
        <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate('/orders')}>
          Back to Orders
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Order Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Customer</p>
            <Link to={`/customers/${order.customerId}`} className="text-sm text-blue-600 hover:text-blue-700">
              {order.customerDisplayName}
            </Link>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Seller</p>
            {order.sellerId ? (
              <Link to={`/sellers/${order.sellerId}`} className="text-sm text-blue-600 hover:text-blue-700">
                {order.sellerDisplayName}
              </Link>
            ) : (
              <p className="text-sm text-gray-600">--</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Type</p>
            <p className="text-sm text-gray-900">{order.isWalkUp ? 'Walk-Up' : 'Pre-Order'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
            <p className="text-sm text-gray-900">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Overall fulfillment progress */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-700">Fulfillment Progress</p>
            <p className="text-sm text-gray-600">{totalFulfilled} / {totalOrdered} ({overallPct}%)</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${overallPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Order Lines */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Line Items ({order.lines.length})</h2>
        </div>
        <OrderLinesTable lines={order.lines} showFulfillment />
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {order.status === 'Open' && (
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              onClick={() => navigate(`/pickup/${order.id}`)}
            >
              Start Pickup
            </button>
          )}
          {order.status === 'InProgress' && (
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              onClick={() => navigate(`/pickup/${order.id}`)}
            >
              Continue Pickup
            </button>
          )}
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            onClick={() => window.open(`/print/order/${order.id}`, '_blank')}
          >
            Print Order
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700"
            onClick={() => navigate(`/orders/${order.id}/edit`)}
          >
            Edit Order
          </button>
        </div>

        {/* Admin Actions */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Admin Actions</p>
          <div className="flex flex-wrap gap-3">
            {order.status !== 'Complete' && (
              <button
                type="button"
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 disabled:opacity-50"
                onClick={handleForceComplete}
              >
                Force Complete
              </button>
            )}
            {(order.status === 'InProgress' || order.status === 'Complete') && (
              <button
                type="button"
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
                onClick={handleReset}
              >
                Reset Order
              </button>
            )}
            <button
              type="button"
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
              onClick={() => setShowDelete(true)}
            >
              Delete Order
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Order"
        message={`Are you sure you want to delete order ${order.orderNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
