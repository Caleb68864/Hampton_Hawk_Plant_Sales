import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { PrintLayout } from '@/components/print/PrintLayout.js';
import { OrderNumberBarcode } from '@/components/print/OrderNumberBarcode.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import type { Order } from '@/types/order.js';

const COUNT_PRESETS = [10, 20, 40, 80];
const DEFAULT_COUNT = 10;

function parseCount(value: string | null): number {
  if (!value) return DEFAULT_COUNT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_COUNT;
  return Math.min(parsed, 200);
}

export function PrintOrderBarcodeRollPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const count = parseCount(searchParams.get('count'));

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    ordersApi
      .getById(orderId)
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const labels = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  function updateCount(next: number) {
    const clamped = Math.max(1, Math.min(next, 200));
    const params = new URLSearchParams(searchParams);
    if (clamped === DEFAULT_COUNT) {
      params.delete('count');
    } else {
      params.set('count', String(clamped));
    }
    setSearchParams(params, { replace: true });
  }

  if (loading) return <LoadingSpinner message="Loading order..." />;
  if (error || !order) return <ErrorBanner message={error ?? 'Order not found'} />;

  return (
    <PrintLayout backTo={`/orders/${order.id}`} className="order-barcode-roll-page">
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
        .order-barcode-bare-svg {
          width: 100%;
          flex: 1 1 auto;
          min-height: 0;
        }
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
            width: 2in;
            height: 1in;
            border-color: transparent;
            break-after: page;
            page-break-after: always;
          }
          .order-barcode-roll-item:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="no-print mb-4 rounded-md border border-gray-300 bg-gray-50 p-3">
        <h1 className="text-lg font-semibold text-gray-800">
          Order Barcode Roll — Order {order.orderNumber}
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          Prints {count} copies of the order-number barcode, one per 2"×1" thermal label. Stick them onto existing printed picker sheets.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COUNT_PRESETS.map((preset) => {
            const active = count === preset;
            return (
              <button
                key={preset}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${active ? 'border-hawk-600 bg-hawk-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                onClick={() => updateCount(preset)}
              >
                {preset} labels
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2">
            <span className="font-medium">Labels to print:</span>
            <input
              type="number"
              min={1}
              max={200}
              step={1}
              value={count}
              onChange={(e) => updateCount(Number.parseInt(e.target.value, 10) || DEFAULT_COUNT)}
              className="w-24 rounded-md border border-gray-300 px-2 py-1"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Calibration hints: use 100% scale, disable "Fit to page", and run a 1-label test before the full roll.
        </p>
      </div>

      <div className="order-barcode-roll-preview">
        {labels.map((i) => (
          <div key={i} className="order-barcode-roll-item">
            <OrderNumberBarcode value={order.orderNumber} variant="bare" />
          </div>
        ))}
      </div>
    </PrintLayout>
  );
}
