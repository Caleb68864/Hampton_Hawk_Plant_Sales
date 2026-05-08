# Camera Scanner — Browser & Device Support

This document describes the supported browsers, devices, and runtime conditions for the mobile camera scanner foundation (`/mobile/scanner-demo` and downstream consumers).

The scanner uses `@zxing/browser` against `getUserMedia`. It decodes locally; no frames or images are uploaded.

## HTTPS requirement

Browsers only expose `getUserMedia` (camera access) on **secure contexts**. In production, every device that runs the scanner must be served over HTTPS.

If the page is loaded over plain HTTP (other than `localhost`), the scanner short-circuits to `error.kind: "insecure-context"`, the camera viewport is replaced with an explicit message, and **manual entry remains available**.

Operationally:

- Production deploys must terminate TLS in front of the web app.
- LAN/staging URLs must use HTTPS or a localhost tunnel; raw IP-over-HTTP will not work.

## Localhost development exception

Browsers grant `getUserMedia` access on `http://localhost` as a developer convenience. This means:

- `http://localhost:5173` (Vite dev server) works without HTTPS.
- `http://127.0.0.1:5173` also works in modern browsers.
- LAN IPs such as `http://192.168.x.y:5173` are **not** considered secure — use a localhost forwarding tool, a self-signed cert, or deploy to staging.

## iPhone Safari

- Tested on iOS 17+. Earlier versions may work but are not part of the support matrix.
- Camera access **requires a user gesture** (tap a button) on the first start. The scanner auto-starts on mount inside the demo route; on Safari, the surrounding navigation tap satisfies this.
- The default camera selection prefers `facingMode: "environment"` (rear camera). If the device exposes only a front camera, ZXing falls back to whatever the OS returns.
- The torch (flashlight) capability is **not exposed** by Safari/WebKit. The torch button is hidden when `torchSupported` is false.
- "Add to Home Screen" PWA instances run in a separate context and must be granted camera permission separately from regular Safari.

## Android Chrome

- Tested on Chrome 120+ on Android 12+.
- `facingMode: "environment"` reliably selects the rear camera.
- Torch is supported on most devices that physically have a flash; the torch button appears when `MediaStreamTrack.getCapabilities().torch === true`.
- Camera-switch button appears when more than one input device is enumerated.
- Permission dialog is per-origin and persists; revoke via Chrome → Site settings → Camera.

## Installed PWA

- When the app is installed as a PWA on Android (Chrome) or iOS (Safari), camera permission must be re-granted; PWA permission state is independent from the browser tab.
- Service workers must **not** intercept `getUserMedia` calls or media streams. The scanner does not cache or replay frames.
- On iOS PWAs, the user-gesture rule still applies for the first camera start.

## Desktop webcam

- Works on Chrome, Edge, and Firefox over HTTPS or localhost.
- `facingMode: "environment"` is ignored on most laptops; ZXing returns the default webcam, which is acceptable for development verification.
- Torch is not supported; torch button is hidden.
- Use the camera-switch button to cycle external USB cameras when present.

## Known limitations

- The native `BarcodeDetector` API is **not** used in this foundation. ZXing-only is the first-pass decision; we may revisit if perf is an issue.
- 4K constraints are explicitly disabled; we request `1280x720` ideal.
- Decoded `code` values are never written to `console.log` / `console.warn` / `console.error`. Diagnostics flow through a single opt-in `console.debug` channel.
