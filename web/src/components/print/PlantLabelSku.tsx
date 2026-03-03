interface PlantLabelSkuProps {
  sku: string;
}

export function PlantLabelSku({ sku }: PlantLabelSkuProps) {
  return <div className="label-sku">SKU: {sku}</div>;
}
