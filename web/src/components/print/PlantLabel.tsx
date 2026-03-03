import type { Plant } from '@/types/plant.js';
import { PlantLabelName } from '@/components/print/PlantLabelName.js';
import { PlantLabelSku } from '@/components/print/PlantLabelSku.js';
import { PlantLabelBarcode } from '@/components/print/PlantLabelBarcode.js';

interface PlantLabelProps {
  plant: Plant;
}

export function PlantLabel({ plant }: PlantLabelProps) {
  return (
    <article className="plant-label" data-plant-id={plant.id}>
      <PlantLabelName name={plant.name} variant={plant.variant} />
      <PlantLabelSku sku={plant.sku} />
      <PlantLabelBarcode value={plant.barcode} />
    </article>
  );
}
