export type ScanSource = "mobile-camera" | "manual-entry";

export type ScannerStatus =
  | "idle"
  | "requesting-permission"
  | "active"
  | "paused"
  | "error"
  | "unsupported";

export type ScannerErrorKind =
  | "permission-denied"
  | "no-camera"
  | "camera-in-use"
  | "decode-error"
  | "insecure-context"
  | "unsupported"
  | "unknown";

export interface ScannerError {
  kind: ScannerErrorKind;
  message: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface NormalizedScanResult {
  code: string;
  format?: string;
  source: ScanSource;
  scannedAtUtc: string;
}
