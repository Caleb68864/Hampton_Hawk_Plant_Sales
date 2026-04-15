const BARCODE_WIDTH = 12;

export function buildPlantBarcode(sku: string | null | undefined): string {
  const trimmed = (sku ?? '').trim();
  if (!trimmed) return '0'.repeat(BARCODE_WIDTH);
  if (trimmed.length >= BARCODE_WIDTH) return trimmed;
  return trimmed.padStart(BARCODE_WIDTH, '0');
}

export function normalizeScannedBarcode(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const stripped = trimmed.replace(/^0+/, '');
  return stripped.length > 0 ? stripped : '0';
}
