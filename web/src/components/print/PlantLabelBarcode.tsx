import type { ReactElement } from 'react';

interface PlantLabelBarcodeProps {
  value: string;
}

function normalizeBarcodeValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'EMPTY';
}

function generateBars(value: string): number[] {
  const bars: number[] = [2, 1, 2, 2, 2, 2];
  for (const char of value) {
    const code = char.charCodeAt(0);
    bars.push((code % 3) + 1, ((code >> 2) % 4) + 1, ((code >> 4) % 3) + 1, ((code >> 6) % 2) + 1);
  }
  bars.push(2, 3, 3, 1, 1, 1, 2);
  return bars;
}

export function PlantLabelBarcode({ value }: PlantLabelBarcodeProps) {
  const barcodeValue = normalizeBarcodeValue(value);
  const bars = generateBars(barcodeValue);
  const totalUnits = bars.reduce((sum, unit) => sum + unit, 0);
  const viewBoxWidth = totalUnits + 6;

  let x = 3;
  const rects: ReactElement[] = [];
  for (let i = 0; i < bars.length; i += 1) {
    const width = bars[i]!;
    if (i % 2 === 0) {
      rects.push(<rect key={`${i}-${width}`} x={x} y={0} width={width} height={30} fill="#000" />);
    }
    x += width;
  }

  return (
    <div className="label-barcode-wrap" aria-label={`Barcode ${barcodeValue}`}>
      <svg className="label-barcode" viewBox={`0 0 ${viewBoxWidth} 42`} role="img" preserveAspectRatio="none">
        {rects}
        <text x={viewBoxWidth / 2} y={40} textAnchor="middle" fontSize="8" fontFamily="monospace">
          {barcodeValue}
        </text>
      </svg>
    </div>
  );
}
