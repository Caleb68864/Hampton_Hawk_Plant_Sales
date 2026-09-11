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

/**
 * The value to send to a scan endpoint for a raw scanner read. Printed labels
 * carry the SKU zero-padded to 12 digits (see buildPlantBarcode) and the server
 * matches `Barcode == x || Sku == x` exactly, so the padding is stripped; a
 * non-numeric read is passed through trimmed. Every scan surface (pickup,
 * pick-list session, walk-up register) must go through this so a label that
 * scans at one station also scans at the others.
 */
export function toScanLookupValue(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  return normalizeScannedBarcode(trimmed) || trimmed;
}
