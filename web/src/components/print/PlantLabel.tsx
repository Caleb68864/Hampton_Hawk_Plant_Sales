import type { Plant } from '@/types/plant.js';
import { PlantLabelBarcode } from '@/components/print/PlantLabelBarcode.js';
import { buildPlantBarcode } from '@/utils/barcode.js';

interface PlantLabelProps {
  plant: Plant;
}

export function PlantLabel({ plant }: PlantLabelProps) {
  const barcodeValue = buildPlantBarcode(plant.sku);
  const displaySku = plant.sku?.trim() ? plant.sku : '—';
  const displayName = plant.variant ? `${plant.name} (${plant.variant})` : plant.name;

  return (
    <article className="plant-label" data-plant-id={plant.id}>
      <div className="plant-label-sku-col">
        <div className="plant-label-sku-text">{displaySku}</div>
        <PlantLabelBarcode value={barcodeValue} />
      </div>
      <div className="plant-label-name-col" title={displayName}>
        {displayName}
      </div>
    </article>
  );
}
