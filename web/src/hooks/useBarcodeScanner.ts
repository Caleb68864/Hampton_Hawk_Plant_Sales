import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { isDuplicate, formatToString } from './scannerHelpers';
import type {
  CameraDevice,
  NormalizedScanResult,
  ScannerStatus,
  ScannerErrorKind,
  ScannerError,
} from '../types/scanner';

const SUPPORTED_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.QR_CODE, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
];

const DECODE_HINTS = new Map<DecodeHintType, unknown>();
DECODE_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);

// ScannerErrorKind and ScannerError re-exported from types/scanner.ts
export type { ScannerErrorKind, ScannerError };

interface ZxingResult {
  getText(): string;
  getBarcodeFormat(): BarcodeFormat;
}

export interface BarcodeScannerOptions {
  cooldownMs?: number;
  onScan: (r: NormalizedScanResult) => void;
  paused?: boolean;
}

export interface BarcodeScannerResult {
  status: ScannerStatus;
  error: ScannerError | null;
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  torchSupported: boolean;
  torchOn: boolean;
  lastResult: NormalizedScanResult | null;
  start: () => Promise<void>;
  stop: () => void;
  switchDevice: (deviceId: string) => Promise<void>;
  toggleTorch: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}
export function useBarcodeScanner(options: BarcodeScannerOptions): BarcodeScannerResult {
  const { cooldownMs = 1000, onScan, paused = false } = options;

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<ScannerError | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastResult, setLastResult] = useState<NormalizedScanResult | null>(null);

  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const prevCodeRef = useRef<string | null>(null);
  const prevAtMsRef = useRef<number>(0);
  const pausedRef = useRef(paused);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const stopTracks = useCallback(() => {
    const videoEl = videoElRef.current;
    if (videoEl?.srcObject) {
      const stream = videoEl.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoEl.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
    stopTracks();
    setStatus('idle');
    setTorchOn(false);
  }, [stopTracks]);

  const handleResult = useCallback(
    (result: ZxingResult) => {
      if (pausedRef.current) return;
      const now = Date.now();
      const code = result.getText();
      if (isDuplicate(prevCodeRef.current, prevAtMsRef.current, code, now, cooldownMs)) return;
      prevCodeRef.current = code;
      prevAtMsRef.current = now;
      const normalized: NormalizedScanResult = {
        code,
        format: formatToString(result.getBarcodeFormat()),
        source: 'mobile-camera',
        scannedAtUtc: new Date(now).toISOString(),
      };
      setLastResult(normalized);
      onScan(normalized);
    },
    [cooldownMs, onScan]
  );
  const ignoreDecodeErr = (err: unknown) => {
    const n = (err as Error).name;
    if (n !== 'NotFoundException' && n !== 'ChecksumException' && n !== 'FormatException') {
      console.error('Decode error:', err);
    }
  };

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      setStatus('error');
      setError({ kind: 'insecure-context', message: 'Camera access requires a secure context (HTTPS or localhost).' });
      return;
    }
    setStatus('requesting-permission');
    setError(null);
    try {
      const reader = new BrowserMultiFormatReader(DECODE_HINTS);
      const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const cameraDevices: CameraDevice[] = videoDevices.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || ('Camera ' + d.deviceId.slice(0, 8)),
      }));
      setDevices(cameraDevices);
      const videoEl = document.createElement('video');
      videoEl.setAttribute('playsinline', 'true');
      videoElRef.current = videoEl;
      const constraints: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false };
      const controls = await reader.decodeFromConstraints(constraints, videoEl, (result, err) => {
        if (result) handleResult(result as unknown as ZxingResult);
        if (err) ignoreDecodeErr(err);
      });
      controlsRef.current = controls;
      setStatus('active');
      if (cameraDevices.length > 0) setSelectedDeviceId(cameraDevices[0].deviceId);
      const stream = videoEl.srcObject as MediaStream | null;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
          setTorchSupported(!!caps?.torch);
        }
      }
    } catch (err) {
      const e = err as Error;
      let kind: ScannerErrorKind = 'unknown';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') kind = 'permission-denied';
      else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') kind = 'no-camera';
      else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') kind = 'camera-in-use';
      setStatus('error');
      setError({ kind, message: e.message });
    }
  }, [handleResult]);
  const switchDevice = useCallback(
    async (deviceId: string) => {
      stop();
      setSelectedDeviceId(deviceId);
      const reader = new BrowserMultiFormatReader(DECODE_HINTS);
      const videoEl = document.createElement('video');
      videoEl.setAttribute('playsinline', 'true');
      videoElRef.current = videoEl;
      try {
        const devControls = await reader.decodeFromVideoDevice(deviceId, videoEl, (result, err) => {
          if (result) handleResult(result as unknown as ZxingResult);
          if (err) ignoreDecodeErr(err);
        });
        controlsRef.current = devControls;
        setStatus('active');
      } catch (err) {
        const e = err as Error;
        setStatus('error');
        setError({ kind: 'unknown', message: e.message });
      }
    },
    [handleResult, stop]
  );

  const toggleTorch = useCallback(async () => {
    const videoEl = videoElRef.current;
    if (!videoEl?.srcObject) return;
    const stream = videoEl.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const newTorchState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newTorchState } as MediaTrackConstraintSet] });
      setTorchOn(newTorchState);
    } catch { /* Torch not supported */ }
  }, [torchOn]);

  const pause = useCallback(() => { pausedRef.current = true; setStatus('paused'); }, []);
  const resume = useCallback(() => { pausedRef.current = false; setStatus('active'); }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopTracks();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      if (controlsRef.current) { controlsRef.current.stop(); controlsRef.current = null; }
      stopTracks();
    };
  }, [stopTracks]);

  return { status, error, devices, selectedDeviceId, torchSupported, torchOn, lastResult, start, stop, switchDevice, toggleTorch, pause, resume };
}
