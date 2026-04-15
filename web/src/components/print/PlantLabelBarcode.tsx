import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface PlantLabelBarcodeProps {
  value: string;
}

export function PlantLabelBarcode({ value }: PlantLabelBarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const barcodeValue = value && value.trim().length > 0 ? value : '0';
    try {
      JsBarcode(svgRef.current, barcodeValue, {
        format: 'CODE128',
        width: 1.6,
        height: 38,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setRenderError(false);
    } catch {
      setRenderError(true);
    }
  }, [value]);

  if (renderError) {
    return (
      <div className="label-barcode-wrap" aria-label="Barcode render error">
        <span className="text-[6px] text-red-600">barcode error</span>
      </div>
    );
  }

  return (
    <div className="label-barcode-wrap" aria-label={`Barcode ${value}`}>
      <svg ref={svgRef} className="label-barcode" role="img" preserveAspectRatio="none" />
    </div>
  );
}
