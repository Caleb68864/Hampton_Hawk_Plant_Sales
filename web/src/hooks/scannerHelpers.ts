import { BarcodeFormat } from "@zxing/library";

export function normalizeManualEntry(input: string): string {
  return input.trim();
}

export function isDuplicate(
  prevCode: string | null,
  prevAtMs: number,
  nextCode: string,
  nowMs: number,
  cooldownMs: number
): boolean {
  if (prevCode === null) return false;
  if (prevCode !== nextCode) return false;
  return nowMs - prevAtMs < cooldownMs;
}

const FORMAT_MAP: Partial<Record<BarcodeFormat, string>> = {
  [BarcodeFormat.QR_CODE]: "qr-code",
  [BarcodeFormat.UPC_A]: "upc-a",
  [BarcodeFormat.UPC_E]: "upc-e",
  [BarcodeFormat.EAN_13]: "ean-13",
  [BarcodeFormat.EAN_8]: "ean-8",
  [BarcodeFormat.CODE_128]: "code-128",
  [BarcodeFormat.CODE_39]: "code-39",
};

export function formatToString(format: BarcodeFormat): string | undefined {
  return FORMAT_MAP[format];
}
