# Verification Report

**Overall: PARTIAL**
**Date:** 2026-05-12 08:30
**Base branch:** `ceadc4f` (parent of `b7cd433`, the implementing commit)
**Spec:** `docs/specs/2026-05-07-camera-scanner-foundation.md`

Verification scope: scanner-foundation files only. Unrelated downstream consumer code (pickup, lookup, connect-mobile) that ships in the same range was excluded from quality review.

## Spec Compliance Review

| Sub-Spec | Criterion | Type | Status | Evidence |
|----------|-----------|------|--------|----------|
| SS-01 | `npm ls @zxing/browser @zxing/library` exits 0 | MECHANICAL | PASS | Both packages resolved (0.2.0 / 0.22.0) |
| SS-01 | `@zxing/*` listed in `dependencies` not `devDependencies` | STRUCTURAL | PASS | `web/package.json` lines 30-31 |
| SS-01 | `npm run build` succeeds | MECHANICAL | PASS | Built in 8.35s |
| SS-01 | REQ-002 `NormalizedScanResult` shape | STRUCTURAL | PASS | `web/src/types/scanner.ts:30-35` — fields match exactly (`code/format?/source/scannedAtUtc`) |
| SS-01 | REQ-003 `ScanSource` union | STRUCTURAL | PASS | `web/src/types/scanner.ts:1` matches spec |
| SS-01 | REQ-003 `ScannerStatus` enum | STRUCTURAL | **FAIL** | Spec: `idle \| starting \| scanning \| paused \| error`. Code (`scanner.ts:3-9`): `idle \| requesting-permission \| active \| paused \| error \| unsupported`. Names diverge (`starting`→`requesting-permission`, `scanning`→`active`) plus extra `unsupported` value. |
| SS-01 | REQ-003 `ScannerErrorKind` enum | STRUCTURAL | **FAIL** | Spec lists 5 kinds. Code (`scanner.ts:11-18`) ships 7 — adds `camera-in-use` and `decode-error`. Contract is supposed to be frozen for downstream consumers (plans 04/05/06). |
| SS-01 | `BrowserMultiFormatReader`/`BarcodeFormat` typecheck without `any` casts | STRUCTURAL | PASS | `web/src/types/__tests__/scanner.types.test.ts:11-12` declares strongly-typed instances. |
| SS-02 | `npx vitest run scannerHelpers.test.ts` passes | MECHANICAL | PASS | 19/19 tests pass |
| SS-02 | helpers named exports | STRUCTURAL | PASS | `scannerHelpers.ts:3,7,29` export `normalizeManualEntry`, `isDuplicate`, `formatToString` |
| SS-02 | `normalizeManualEntry` behavior | BEHAVIORAL | PASS (code trace) | `scannerHelpers.ts:4` — `input.trim()`; interior whitespace preserved |
| SS-02 | `isDuplicate` behavior | BEHAVIORAL | PASS (code trace) | `scannerHelpers.ts:14-16` — null short-circuits, code mismatch short-circuits, `nowMs - prevAtMs < cooldownMs` boundary correct |
| SS-02 | `formatToString` returns canonical strings for 7 formats | BEHAVIORAL | PASS (code trace) | `scannerHelpers.ts:19-27` maps QR_CODE/UPC_A/UPC_E/EAN_13/EAN_8/CODE_128/CODE_39 |
| SS-03 | `npm run build` succeeds | MECHANICAL | PASS | Build green |
| SS-03 | `npm run lint` no new violations in new files | MECHANICAL | PASS | Pre-existing 31 lint errors in unrelated files (`WalkupVsPreorderPage.tsx`, `orderLookup.ts`); zero in scanner files |
| SS-03 | Hook imports only `BrowserMultiFormatReader`, `BarcodeFormat`, `DecodeHintType` from ZXing | STRUCTURAL | PASS | `useBarcodeScanner.ts:2-3` |
| SS-03 | Hook has no `api/`, `stores/`, fulfillment imports | STRUCTURAL | PASS | grep returned no matches |
| SS-03 | Hook has no `fetch(`/`axios`/`FormData`/`new Blob(` | STRUCTURAL | PASS | grep returned no matches |
| SS-03 | Cleanup stops media tracks on unmount + visibility hidden | STRUCTURAL | **PARTIAL** | `useBarcodeScanner.ts:198-203` visibility-hidden calls `stopTracks()` (stops tracks + clears srcObject) but does NOT call `controlsRef.current.stop()`, so the ZXing decode loop continues running until next start. Unmount cleanup (`useBarcodeScanner.ts:205-210`) DOES call both. |
| SS-03 | Vitest mocks BrowserMultiFormatReader; duplicate/paused/permission-denied/track-stop | BEHAVIORAL | **NEEDS_REVIEW** | The hook test file `web/src/hooks/__tests__/useBarcodeScanner.test.tsx` referenced in SS-03 was not added to the repo (test plan file list does not include it). 4 behaviors covered indirectly through component tests but the hook-level test is missing. |
| SS-03 | Insecure-context short-circuit | BEHAVIORAL | PASS (code trace) | `useBarcodeScanner.ts:113-117` — checks `window.isSecureContext` before any `decodeFromConstraints` call |
| SS-04 | `npm run build` / `npm run lint` | MECHANICAL | PASS | Same evidence as above |
| SS-04 | Imports `ScanInputShell` and renders it for manual entry | STRUCTURAL | PASS | `BarcodeScanner.tsx:4,195-204` |
| SS-04 | Imports `useBarcodeScanner`, never calls `BrowserMultiFormatReader` directly | STRUCTURAL | PASS | `BarcodeScanner.tsx:2`; no direct ZXing import |
| SS-04 | CSS animations wrapped by `prefers-reduced-motion` | STRUCTURAL | PASS | `mobile-theme.css:212-220` overrides both `.mobile-scanner-reticle` and `.mobile-scanner-corner.is-flash` to `animation: none` |
| SS-04 | Status pill uses `mobile-type-eyebrow` and `tabular-nums` | STRUCTURAL | PASS | `BarcodeScanner.tsx:164` |
| SS-04 | Test asserts mocked decode invokes `onScan` with `mobile-camera`+format+ISO | BEHAVIORAL | PASS | `BarcodeScanner.test.tsx` — 5 tests pass |
| SS-04 | Permission-denied empty-state still renders ScanInputShell | BEHAVIORAL | PASS (code trace) | `BarcodeScanner.tsx:141-208` — empty-state branch keeps `<form>` containing `<ScanInputShell>` mounted unconditionally |
| SS-04 | Torch hidden when unsupported | BEHAVIORAL | PASS (code trace) | `BarcodeScanner.tsx:169-179` — gated on `torchSupported` |
| SS-04 | REQ-007 reticle dimensions 240×80 (1D) / 200×200 (QR) | STRUCTURAL | PASS | `BarcodeScanner.tsx:14-15` |
| SS-04 | REQ-011 corner flash 120ms, reticle pulse 1.6s | STRUCTURAL | PASS | `mobile-theme.css:184,196` — `animation: mobile-scanner-corner-flash 120ms linear` and `mobile-scanner-reticle-pulse 1.6s ease-in-out infinite` |
| SS-05 | `npm run build` / `lint` / `vitest mobileRouteConfig.test.ts` | MECHANICAL | PASS | 16/16 route-config tests pass |
| SS-05 | App.tsx route nested in MobileLayout block | STRUCTURAL | PASS | `App.tsx:152` |
| SS-05 | MobileScannerDemoPage imports `BarcodeScanner` | STRUCTURAL | PASS | `MobileScannerDemoPage.tsx:2,23` |
| SS-05 | Browser-support doc covers required sections | STRUCTURAL | PASS | All 6 sections present in `docs/scanner/browser-support.md` |
| SS-05 | Fixtures doc covers required scenarios with non-real values | STRUCTURAL | PASS | `docs/tests/scanner-fixtures.md` — synthetic values only |
| SS-05 | `BarcodeScanner` reachable from a wired route | INTEGRATION | PASS | `App.tsx:66,152` → `MobileScannerDemoPage` → `BarcodeScanner` |
| SS-05 | All sub-spec modules transitively importable | INTEGRATION | PASS | App.tsx is the entry point; chain verified |
| SS-05 | Demo page vitest mocks hook, asserts last-5 list reverse-chronological | BEHAVIORAL | **NEEDS_REVIEW** | No vitest file at `web/src/pages/mobile/__tests__/MobileScannerDemoPage.test.tsx` exists. Spec criterion not satisfied. |
| SS-05 | Manual device verification on Android Chrome + iPhone Safari | HUMAN REVIEW | NEEDS_REVIEW | Per spec, requires physical device pass. Not auto-verifiable. |
| Cross | REQ-005 `decodeFromConstraints` uses `width.ideal: 1280, height.ideal: 720` | STRUCTURAL | **FAIL** | `useBarcodeScanner.ts:131` ships `{ video: { facingMode: 'environment' }, audio: false }` only — no width/height ideal. `docs/scanner/browser-support.md:58` documents "1280×720 ideal" but code disagrees. |
| Cross | REQ-006 ZXing restricted to 7 formats | STRUCTURAL | PASS | `useBarcodeScanner.ts:13-20` |
| Cross | REQ-015 tracks stop on unmount, route change, explicit stop, permission failure, visibility hidden | STRUCTURAL | **PARTIAL** | Unmount + explicit stop ✓; route-change inherits unmount cleanup ✓; visibility-hidden stops tracks but does not stop ZXing decoder; permission-failure catch block sets error state but does not invoke `stop()` to clean up if a partial stream started. |
| Cross | REQ-021 demo page role gate matches `/mobile/pickup` (Pickup or Admin) | STRUCTURAL | **PARTIAL** | `mobileRouteConfig.ts:33-38` ships `role: ADMIN_ONLY` (Admin only). Spec said "the same way as `/mobile/pickup`" which is `Pickup + Admin`. Stricter than spec — defensible but a deviation. |
| Cross | REQ-023 opt-in `console.debug` diagnostic channel | STRUCTURAL | **FAIL** | grep finds zero `console.debug` calls in scanner files. Diagnostics surface (status, camera label, permission state, source, duplicate-suppression hits) is unimplemented. `useBarcodeScanner.ts:108` does have `console.error` for non-standard decode exceptions; no decoded `code` is logged so REQ-023's "never log codes" remains upheld. |
| Cross | REQ-026 build/lint/test all succeed | MECHANICAL | PASS | Build ✓, lint clean within scanner scope, scanner vitest suites green |
| Cross | REQ-027 BarcodeScanner is not orphaned | STRUCTURAL | PASS | Demo page consumes it |

**Compliance result:** PARTIAL — 5 FAIL / PARTIAL findings (REQ-003 status enum, REQ-003 error enum, REQ-005 constraints, REQ-015 cleanup completeness, REQ-021 role gate, REQ-023 debug channel), 2 NEEDS_REVIEW (hook unit test missing, demo page unit test missing), majority pass.

## Code Quality Review

| Severity | File | Finding |
|----------|------|---------|
| IMPORTANT | `web/src/components/mobile/BarcodeScanner.tsx:82-104` | `useEffect` that mounts the hook's offscreen `<video>` works by `document.querySelectorAll('video').find(...)` and moving the element into a container `ref`. This couples to hook internals (the fact that the hook creates a detached `<video>`) and is fragile if a second component renders before this one. A cleaner contract: hook exposes a `videoRef` or the component owns the `<video>` and passes it to the hook. |
| IMPORTANT | `web/src/components/mobile/BarcodeScanner.tsx:74-80` | Auto-start camera on mount uses an empty deps array with `eslint-disable react-hooks/exhaustive-deps`. On iOS Safari this can violate the user-gesture rule (the spec docs themselves note this) — the surrounding nav tap usually carries gesture context, but it's worth documenting why the suppression is intentional. |
| IMPORTANT | `web/src/hooks/useBarcodeScanner.ts:108` | `console.error('Decode error:', err)` for non-standard decode exceptions does not violate GP-S2 (it's `error` not `log`) but it bypasses the spec's REQ-023 "single opt-in `console.debug` channel". Either route through that channel or drop it. |
| IMPORTANT | Missing test files | Spec SS-03 lists `web/src/hooks/__tests__/useBarcodeScanner.test.tsx` as a new file; not present. Spec SS-05 implies `MobileScannerDemoPage.test.tsx`; not present. |
| SUGGESTION | `web/src/hooks/useBarcodeScanner.ts:22-23` | `ScannerErrorKind` and `ScannerError` are re-exported from the hook even though they're already exported from `types/scanner.ts`. Duplication invites drift; consumers should import from the types module. |
| SUGGESTION | `web/src/components/mobile/BarcodeScanner.tsx:210-309` | Inline `<style>{`...`}</style>` block (100 lines of CSS) lives in the component file. The rest of the scanner CSS sits in `mobile-theme.css`. Consistent home for component styles avoids the next reader hunting in two places. |
| SUGGESTION | `web/src/hooks/useBarcodeScanner.ts:189` | `track.applyConstraints({ advanced: [{ torch: ... } as MediaTrackConstraintSet] })` — the `as` cast hides that `torch` isn't in the standard `MediaTrackConstraintSet` typing. Acceptable but a brief comment explaining "WICG capture-extensions, not yet in lib.dom" would help future readers. |

**Quality result:** PARTIAL — 4 IMPORTANT, 3 SUGGESTION, 0 CRITICAL.

## Golden Principles Review

### Scripted Checks

| Principle | Status | Evidence |
|-----------|--------|----------|
| GP-S1: No secrets in source (scanner files) | PASS | grep clean |
| GP-S2: No debug statements (scanner files) | PASS | grep finds no `console.log`/`debugger;`/`breakpoint()` in scanner files |
| GP-S3: No files over 500 lines (scanner files) | PASS | Largest: `BarcodeScanner.tsx` 314 lines, `useBarcodeScanner.ts` 213 lines |
| GP-S4: Conventional commit format on HEAD | PASS | `feat(mobile): add /mobile/account page...` matches |
| GP-S5: Tests pass | PASS | All 40 scanner-scope tests green |
| GP-S6: Build compiles | PASS | `npm run build` exits 0 |

### Advisory Checks

| Principle | Status | Note |
|-----------|--------|------|
| GP-A1: Tests for new public functions | ADVISORY | `useBarcodeScanner` (the largest public surface) has no dedicated unit test file — coverage is indirect via component tests. Spec SS-03 explicitly required this file. |
| GP-A2: No unhandled async operations | ADVISORY | `BarcodeScanner.tsx:76` uses `void start()` (fire-and-forget). `start()` swallows its own errors into state, so this is intentional — but the convention deserves a comment. |
| GP-A3: Decomposition quality | PASS | 5 sub-specs, each 1-3 files, fits 30-90 min envelope. |
| GP-A4: Evaluation design exists | PASS | Acceptance criteria are testable; `docs/tests/scanner-fixtures.md` provides reproducible fixtures. |

**Golden Principles result:** PASS

## Summary

- Spec compliance: PARTIAL — 41 criteria checked, 32 pass, 6 FAIL/PARTIAL, 3 NEEDS_REVIEW
- Code quality: PARTIAL — 7 findings (0 CRITICAL, 4 IMPORTANT, 3 SUGGESTION)
- Golden principles: PASS — 6/6 scripted checks pass, 2 advisory flags

## Recommendations

Address in this order. None block the feature from shipping behind the existing `enabled: false, role: ['Admin']` gate, but downstream plans 04/05/06 depend on the foundation contract being correct.

1. **(IMPORTANT) Reconcile REQ-003 type contract** — either update the spec to match shipped enums (`requesting-permission`/`active`/`unsupported`/`camera-in-use`/`decode-error`) or rename the implementation to spec values. Pickup/lookup workflows will branch on these strings; lock them down before plan 04 starts.
2. **(IMPORTANT) Add `width.ideal: 1280, height.ideal: 720` to `decodeFromConstraints`** at `useBarcodeScanner.ts:131`. The docs already claim this is set. Either the docs are wrong or the code is.
3. **(IMPORTANT) Implement REQ-023 opt-in `console.debug` channel** — even a single guarded helper (`if (options.diagnostics) console.debug('[scanner]', ...)`) satisfies the contract and gives the human-review pass a way to confirm state transitions on device.
4. **(IMPORTANT) Add missing test files** — `useBarcodeScanner.test.tsx` and `MobileScannerDemoPage.test.tsx`. Cooldown, paused, permission-denied, and history-list-ordering paths are not currently asserted.
5. **(IMPORTANT) Tighten visibility-hidden cleanup** — call `controlsRef.current?.stop()` alongside `stopTracks()` in the `visibilitychange` handler so the decoder loop exits.
6. **(SUGGESTION) Decide on REQ-021 role gate** — current Admin-only is safer than spec; either accept the deviation (recommended) and update the spec, or expand to `Pickup+Admin` to match.
