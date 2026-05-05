---
date: 2026-05-05
topic: "Reusable camera barcode and QR scanner foundation"
author: Caleb Bennett
status: draft
tags:
  - design
  - camera-scanner
  - barcode
  - qr-code
  - mobile
---

# Camera Scanner Foundation -- Design

## Summary
Add a reusable React + TypeScript camera scanner foundation for mobile workflows using `@zxing/browser` and `@zxing/library`. The scanner decodes barcodes and QR codes locally in the browser, emits normalized scan payloads, and always provides manual entry as a first-class input path.

## Approach Selected
**Workflow-Agnostic Scanner Component.** The scanner owns camera lifecycle and decoded-value input, but pickup, lookup, and POS workflows decide what a decoded value means.

## Architecture
```text
Mobile workflow page
        |
        v
Reusable BarcodeScanner / useBarcodeScanner
        |
        +--> camera decode via ZXing
        +--> manual entry
        |
        v
normalized scan payload
        |
        v
workflow-specific API call
```

The scanner must not upload images or video frames. It sends only decoded text, optional format, source, and timestamp to the consuming workflow.

## Components
**`BarcodeScanner`** renders video preview, scan overlay, start/stop controls, camera switcher, torch toggle when supported, manual entry, last scanned value, loading/paused state, and accessible status messages.

**`useBarcodeScanner`** owns `BrowserMultiFormatReader`, camera startup, camera cleanup, device enumeration, decode lifecycle, duplicate cooldown, pending-state pause, and unmount cleanup.

**`scannerTypes`** defines scan payloads, supported format names, scanner status, scanner errors, camera device metadata, and callback contracts.

**Manual entry control** is always available, whether or not a camera exists. It should emit the same normalized payload shape as camera scanning with `source: "manual-entry"`.

**Optional scan API helper** can provide a generic lookup contract only if needed. Workflow-specific APIs should remain in their existing domain modules when the scan directly triggers fulfillment or order lookup.

## Data Flow
On start, the scanner requests camera access with rear-camera preferences:

- `facingMode: "environment"`
- `width ideal 1280`
- `height ideal 720`

After permission is granted, it enumerates camera devices for switching. ZXing is configured with a restricted default format set:

- QR Code
- UPC-A
- UPC-E
- EAN-13
- EAN-8
- Code 128
- Code 39

On decode, the scanner emits:

```text
{ code, format?, source: "mobile-camera" | "manual-entry", scannedAtUtc }
```

The consuming workflow pauses scanning while its backend request is pending and resumes only when safe.

## Error Handling
- Permission denied shows camera-permission guidance and keeps manual entry available.
- No camera available keeps manual entry available.
- Unsupported scanner/browser keeps manual entry available.
- Rear camera unavailable falls back to available cameras.
- Torch unsupported hides or disables the torch control.
- Decode misses should not spam visible errors; scanning continues quietly.
- Same value within a cooldown window, such as 1000ms, is ignored.
- Scanner does not submit while a backend request is in flight.
- Camera tracks must stop on unmount, stop scan, route changes, and permission failures.

## Open Questions
- Decide whether to include a scanner demo/test route under `/mobile/scanner-demo` for verification only.
- Decide exact audio/vibration behavior. Recommendation: short vibration/beep on successful accepted scan, respecting browser support.
- Confirm whether `BarcodeDetector` is worth adding later as optional progressive enhancement. Recommendation: not in first pass.

## Approaches Considered
**Native BarcodeDetector First** was rejected because browser support is too uneven for sale-day reliability.

**Workflow-Specific Camera Scanners** was rejected because pickup and lookup would duplicate camera lifecycle code.

**Workflow-Agnostic ZXing Scanner** was selected because `@zxing/browser` supports the required formats and keeps scanning reusable across mobile workflows.

## Next Steps
- [ ] Turn this design into a Forge spec after mobile shell planning.
- [ ] Add `@zxing/browser` and `@zxing/library`.
- [ ] Define scanner component contracts before integrating with pickup or lookup.
- [ ] Verify Android Chrome, iPhone Safari, desktop webcam, permission denial, no camera, and duplicate scan behavior.
