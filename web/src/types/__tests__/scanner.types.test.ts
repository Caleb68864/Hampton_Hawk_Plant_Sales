import { describe, expect, it } from "vitest";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat } from "@zxing/library";
import type {
  NormalizedScanResult,
  ScanSource,
  ScannerStatus,
  ScannerErrorKind,
  CameraDevice,
} from "../scanner";

// Compile-time contract check: these assignments fail `tsc -b` if the scanner
// types drift from what the zxing adapter and the mobile pages assume.
const reader: BrowserMultiFormatReader = new BrowserMultiFormatReader();
const format: BarcodeFormat = BarcodeFormat.QR_CODE;

const result: NormalizedScanResult = {
  code: "12345",
  format: "QR_CODE",
  source: "mobile-camera" as ScanSource,
  scannedAtUtc: new Date().toISOString(),
};

const status: ScannerStatus = "idle";
const errorKind: ScannerErrorKind = "permission-denied";
const device: CameraDevice = { deviceId: "abc", label: "Front Camera" };

describe("scanner types", () => {
  it("shape a normalized scan result the way the mobile pages expect", () => {
    expect(reader).toBeInstanceOf(BrowserMultiFormatReader);
    expect(format).toBe(BarcodeFormat.QR_CODE);
    expect(result.code).toBe("12345");
    expect(result.source).toBe("mobile-camera");
    expect(status).toBe("idle");
    expect(errorKind).toBe("permission-denied");
    expect(device.deviceId).toBe("abc");
  });
});
