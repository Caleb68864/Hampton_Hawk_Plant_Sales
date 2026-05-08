import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat } from "@zxing/library";
import type {
  NormalizedScanResult,
  ScanSource,
  ScannerStatus,
  ScannerErrorKind,
  CameraDevice,
} from "../scanner";

const _reader: BrowserMultiFormatReader = new BrowserMultiFormatReader();
const _format: BarcodeFormat = BarcodeFormat.QR_CODE;

const result: NormalizedScanResult = {
  code: "12345",
  format: "QR_CODE",
  source: "mobile-camera" as ScanSource,
  scannedAtUtc: new Date().toISOString(),
};

const status: ScannerStatus = "idle";
const errorKind: ScannerErrorKind = "permission-denied";
const device: CameraDevice = { deviceId: "abc", label: "Front Camera" };

export { _reader, _format, result, status, errorKind, device };
