import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner.js';
import { normalizeManualEntry } from '../../hooks/scannerHelpers.js';
import { ScanInputShell } from './ScanInputShell.js';
import type { NormalizedScanResult, ScannerError } from '../../types/scanner.js';

export interface BarcodeScannerProps {
  onScan: (r: NormalizedScanResult) => void;
  paused?: boolean;
  eyebrow?: string;
  reticleShape?: '1d' | 'qr';
}

const RETICLE_DIM_1D = { width: 240, height: 80 };
const RETICLE_DIM_QR = { width: 200, height: 200 };

function statusLabel(status: string): string {
  switch (status) {
    case 'idle': return 'Camera off';
    case 'requesting-permission': return 'Starting camera...';
    case 'active': return 'Searching...';
    case 'paused': return 'Paused';
    case 'error': return 'Camera off';
    case 'unsupported': return 'Unsupported';
    default: return 'Ready';
  }
}

function errorHeadline(error: ScannerError | null): string {
  if (!error) return 'Camera unavailable';
  switch (error.kind) {
    case 'permission-denied': return 'Camera permission needed';
    case 'no-camera': return 'No camera detected';
    case 'insecure-context': return 'HTTPS required for camera';
    case 'unsupported': return 'Camera not supported';
    case 'camera-in-use': return 'Camera already in use';
    default: return 'Camera unavailable';
  }
}

function errorBody(error: ScannerError | null): string {
  if (!error) return 'Use manual entry below.';
  switch (error.kind) {
    case 'permission-denied':
      return 'Open browser settings → Site permissions → Camera, then reload. Manual entry stays available below.';
    case 'no-camera':
      return 'No video device found. Manual entry below works without a camera.';
    case 'insecure-context':
      return 'The camera path requires HTTPS or localhost. Manual entry remains available below.';
    case 'unsupported':
      return 'This browser cannot use the camera scanner. Try Chrome on Android or Safari on iOS, or use manual entry below.';
    case 'camera-in-use':
      return 'Another tab or app is using the camera. Close it and reload, or use manual entry below.';
    default:
      return 'Manual entry below stays available.';
  }
}

export function BarcodeScanner({
  onScan,
  paused = false,
  eyebrow = 'Scanner',
  reticleShape = '1d',
}: BarcodeScannerProps) {
  const scanner = useBarcodeScanner({ onScan, paused });
  const { status, error, devices, torchSupported, torchOn, start, stop, switchDevice, toggleTorch, lastResult } =
    scanner;

  const videoMountRef = useRef<HTMLDivElement | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [flash, setFlash] = useState(false);

  // Auto-start camera on mount (best-effort).
  useEffect(() => {
    if (status === 'idle') {
      void start();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount the hook's offscreen <video> into our card when active.
  useEffect(() => {
    const mount = videoMountRef.current;
    if (!mount) return;
    // The hook creates a <video> via document.createElement and assigns srcObject.
    // We grab any <video> with srcObject from the document and adopt it visually.
    // Simpler: scan all video elements created since mount; the hook stores it as
    // an offscreen element. Use a polling MutationObserver-ish approach: attempt
    // to find a video with a MediaStream and move it inside this container.
    if (status !== 'active') return;
    const allVideos = Array.from(document.querySelectorAll('video'));
    const live = allVideos.find((v) => v.srcObject instanceof MediaStream && v.parentElement !== mount);
    if (live) {
      // Clear the off-screen positioning styles the hook applied to keep the
      // video hidden before adoption. Without this the element stays at
      // left:-9999px / opacity:0 inside the visible card and the preview is black.
      live.style.position = '';
      live.style.left = '';
      live.style.top = '';
      live.style.opacity = '';
      live.style.pointerEvents = '';
      live.style.width = '100%';
      live.style.height = '100%';
      live.style.objectFit = 'cover';
      live.muted = true;
      live.autoplay = true;
      live.setAttribute('playsinline', 'true');
      mount.appendChild(live);
      void live.play().catch(() => undefined);
    }
  }, [status]);

  // Bracket flash when a fresh scan lands.
  useEffect(() => {
    if (!lastResult) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 120);
    return () => clearTimeout(t);
  }, [lastResult]);

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paused) return;
    const code = normalizeManualEntry(manualValue);
    if (!code) return;
    onScan({
      code,
      source: 'manual-entry',
      scannedAtUtc: new Date().toISOString(),
    });
    setManualValue('');
  };

  const reticleDim = reticleShape === 'qr' ? RETICLE_DIM_QR : RETICLE_DIM_1D;
  const isError = status === 'error' || status === 'unsupported';

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const currentId = scanner.selectedDeviceId;
    const next = devices.find((d) => d.deviceId !== currentId) ?? devices[0];
    if (next) void switchDevice(next.deviceId);
  };

  return (
    <div className="mobile-scanner" data-testid="barcode-scanner">
      <div className="mobile-scanner__eyebrow mobile-type-eyebrow">{eyebrow}</div>

      {isError ? (
        <div className="mobile-scanner__empty" role="alert">
          <h2 className="mobile-scanner__empty-title">{errorHeadline(error)}</h2>
          <p className="mobile-scanner__empty-body">{errorBody(error)}</p>
        </div>
      ) : (
        <div className="mobile-scanner__viewport">
          <div className="mobile-scanner__video" ref={videoMountRef} aria-hidden="true" />

          {/* Corner brackets */}
          <span className={`mobile-scanner-corner mobile-scanner-corner--tl ${flash ? 'is-flash' : ''}`} aria-hidden="true" />
          <span className={`mobile-scanner-corner mobile-scanner-corner--tr ${flash ? 'is-flash' : ''}`} aria-hidden="true" />
          <span className={`mobile-scanner-corner mobile-scanner-corner--bl ${flash ? 'is-flash' : ''}`} aria-hidden="true" />
          <span className={`mobile-scanner-corner mobile-scanner-corner--br ${flash ? 'is-flash' : ''}`} aria-hidden="true" />

          {/* Reticle */}
          <span
            className="mobile-scanner-reticle"
            style={{ width: reticleDim.width, height: reticleDim.height }}
            aria-hidden="true"
          />

          {/* Status pill */}
          <div className="mobile-scanner-status-pill mobile-type-eyebrow tabular-nums" role="status">
            {statusLabel(status)}
          </div>

          {/* Torch button — hidden when unsupported */}
          {torchSupported && (
            <button
              type="button"
              className="mobile-scanner__corner-btn mobile-scanner__corner-btn--torch"
              onClick={() => void toggleTorch()}
              aria-pressed={torchOn}
              aria-label="Toggle torch"
            >
              <span aria-hidden="true">{torchOn ? '☀' : '☼'}</span>
            </button>
          )}

          {/* Camera switch — only if more than one device */}
          {devices.length > 1 && (
            <button
              type="button"
              className="mobile-scanner__corner-btn mobile-scanner__corner-btn--switch"
              onClick={handleSwitchCamera}
              aria-label="Switch camera"
            >
              <span aria-hidden="true">⟳</span>
            </button>
          )}
        </div>
      )}

      <form className="mobile-scanner__manual" onSubmit={handleManualSubmit}>
        <ScanInputShell
          label="Manual entry"
          hint="Type or paste a code, then press Enter."
          value={manualValue}
          onChange={(e) => setManualValue(e.currentTarget.value)}
          placeholder="Order or barcode"
          inputMode="text"
          aria-label="Manual scan entry"
        />
        <button type="submit" className="mobile-scanner__manual-submit" disabled={paused || !manualValue.trim()}>
          Submit
        </button>
      </form>

      <style>{`
        .mobile-scanner {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          border-radius: var(--mobile-radius, 16px);
          background: var(--joy-paper, #fff);
          border: 1px solid var(--joy-rule, #e8e0f0);
        }
        .mobile-scanner__eyebrow { color: var(--color-hawk-700, #441d55); }
        .mobile-scanner__viewport {
          position: relative;
          aspect-ratio: 4 / 3;
          width: 100%;
          background: #0a0014;
          border-radius: var(--mobile-radius, 16px);
          overflow: hidden;
          padding-top: env(safe-area-inset-top, 0);
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .mobile-scanner__video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .mobile-scanner__video > video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover;
        }
        .mobile-scanner__empty {
          padding: 32px 24px;
          background: var(--color-gold-50, #fffbf0);
          border: 1px dashed var(--color-gold-300, #f0c84a);
          border-radius: var(--mobile-radius, 16px);
          text-align: center;
        }
        .mobile-scanner__empty-title {
          font-family: var(--font-display, "Fraunces", serif);
          font-weight: 600;
          font-size: 24px;
          line-height: 1.2;
          color: var(--color-hawk-900, #1e0a35);
          margin: 0 0 8px;
        }
        .mobile-scanner__empty-body {
          font-family: var(--font-body, "Manrope", sans-serif);
          font-size: 14px;
          color: var(--color-hawk-700, #441d55);
          margin: 0;
        }
        .mobile-scanner__corner-btn {
          position: absolute;
          width: 56px;
          height: 56px;
          min-width: var(--mobile-touch-min, 56px);
          min-height: var(--mobile-touch-min, 56px);
          border-radius: var(--mobile-radius-full, 9999px);
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.35);
          backdrop-filter: blur(6px);
          font-size: 22px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .mobile-scanner__corner-btn--torch {
          top: calc(12px + env(safe-area-inset-top, 0px));
          right: 12px;
        }
        .mobile-scanner__corner-btn--switch {
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          right: 12px;
        }
        .mobile-scanner__manual {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-scanner__manual-submit {
          align-self: flex-end;
          padding: 10px 18px;
          border-radius: var(--mobile-radius-sm, 10px);
          background: var(--color-hawk-700, #441d55);
          color: #fff;
          font-family: var(--font-body, "Manrope", sans-serif);
          font-weight: 600;
          font-size: 14px;
          border: none;
          cursor: pointer;
          min-height: 44px;
        }
        .mobile-scanner__manual-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default BarcodeScanner;
