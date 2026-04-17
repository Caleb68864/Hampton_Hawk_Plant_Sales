import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import type { Order } from '@/types/order.js';

const DEFAULT_COUNT = 1;
const MAX_COUNT_PER_ORDER = 200;
const ORDERS_PAGE_SIZE = 200;

function parseCount(value: string | null): number {
  if (!value) return DEFAULT_COUNT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_COUNT;
  return Math.min(parsed, MAX_COUNT_PER_ORDER);
}

export function PrintOrderBarcodesBulkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const count = parseCount(searchParams.get('count'));
  const ids = useMemo(() => (searchParams.get('ids') ?? '').split(',').filter(Boolean), [searchParams]);
  const status = searchParams.get('status');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        if (ids.length > 0) {
          const results = await Promise.all(ids.map((id) => ordersApi.getById(id)));
          if (!cancelled) setOrders(results);
        } else if (status) {
          const first = await ordersApi.list({ page: 1, pageSize: ORDERS_PAGE_SIZE, status });
          const all = [...first.items];
          const totalPages = Math.max(first.totalPages, Math.ceil(first.totalCount / ORDERS_PAGE_SIZE));
          for (let p = 2; p <= totalPages; p++) {
            const next = await ordersApi.list({ page: p, pageSize: ORDERS_PAGE_SIZE, status });
            all.push(...next.items);
          }
          if (!cancelled) setOrders(all);
        } else {
          if (!cancelled) setError('No orders specified. Pass ?ids=a,b,c or ?status=Open.');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [ids, status]);

  function updateCount(next: number) {
    const clamped = Math.max(1, Math.min(next, MAX_COUNT_PER_ORDER));
    const params = new URLSearchParams(searchParams);
    if (clamped === DEFAULT_COUNT) {
      params.delete('count');
    } else {
      params.set('count', String(clamped));
    }
    setSearchParams(params, { replace: true });
  }

  if (loading) return <LoadingSpinner message="Loading orders..." />;
  if (error) return <ErrorBanner message={error} />;
  if (orders.length === 0) return <ErrorBanner message="No orders to print." />;

  const totalLabels = orders.length * count;

  return (
    <PrintLayout backTo="/orders" className="order-barcode-roll-page">
      <style>{`
        .order-barcode-roll-preview {
          width: min(100%, 2.35in);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.18in;
        }
        .order-barcode-roll-item {
          width: 2in;
          height: 1in;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed transparent;
          background: #fff;
          overflow: hidden;
        }
        .order-barcode-bare {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.04in 0.08in;
          gap: 0.02in;
        }
        .order-barcode-bare-svg { width: 100%; flex: 1 1 auto; min-height: 0; }
        .order-barcode-bare-caption {
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 7pt;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: #111827;
          line-height: 1;
          margin: 0;
        }
        @media print {
          @page { size: 2in 1in; margin: 0; }
          .order-barcode-roll-page { max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .order-barcode-roll-preview { width: 2in; gap: 0; margin: 0; }
          .order-barcode-roll-item {
            width: 2in; height: 1in;
            border-color: transparent;
            break-after: page;
            page-break-after: always;
          }
          .order-barcode-roll-item:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      <div className="no-print mb-4 rounded-md border border-gray-300 bg-gray-50 p-3">
        <h1 className="text-lg font-semibold text-gray-800">
          Order Barcode Roll — {orders.length} orders × {count} labels = {totalLabels} total
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          Prints a stack of {count} labels for each selected order on 2"×1" thermal stock.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2">
            <span className="font-medium">Labels per order:</span>
            <input
              type="number"
              min={1}
              max={MAX_COUNT_PER_ORDER}
              step={1}
              value={count}
              onChange={(e) => updateCount(Number.parseInt(e.target.value, 10) || DEFAULT_COUNT)}
              className="w-24 rounded-md border border-gray-300 px-2 py-1"
            />
          </label>
        </div>
      </div>

      <div className="order-barcode-roll-preview">
        {orders.flatMap((order) =>
          Array.from({ length: count }, (_, i) => (
            <div key={`${order.id}-${i}`} className="order-barcode-roll-item">
              <OrderNumberBarcode value={order.barcode ?? order.orderNumber} variant="bare" />
            </div>
          )),
        )}
      </div>
    </PrintLayout>
  );
}
