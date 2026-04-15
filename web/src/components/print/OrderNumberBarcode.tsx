import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface OrderNumberBarcodeProps {
  value: string;
  variant?: 'card' | 'bare';
}

export function OrderNumberBarcode({ value, variant = 'card' }: OrderNumberBarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: variant === 'bare' ? 1.8 : 1.8,
        height: variant === 'bare' ? 48 : 48,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#111827',
      });
      setRenderError(false);
    } catch {
      setRenderError(true);
    }
  }, [value, variant]);

  if (variant === 'bare') {
    return (
      <div className="order-barcode-bare" aria-label={`Order barcode ${value}`}>
        {renderError ? (
          <div className="text-[10px] text-red-600">Barcode render error for {value}</div>
        ) : (
          <svg ref={svgRef} className="order-barcode-bare-svg" role="img" aria-label={`Order barcode ${value}`} preserveAspectRatio="none" />
        )}
        <p className="order-barcode-bare-caption">{value}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-[320px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-center print:mt-2 print:max-w-[280px] print:px-3 print:py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">Scan for pickup</p>
      {renderError ? (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Barcode failed to render for this order number.
        </div>
      ) : (
        <svg ref={svgRef} className="mt-2 h-14 w-full" role="img" aria-label={`Order barcode ${value}`} />
      )}
      <p className="mt-2 font-mono text-sm font-semibold tracking-[0.2em] text-gray-700">{value}</p>
    </div>
  );
}
