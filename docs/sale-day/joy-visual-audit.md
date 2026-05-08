---
title: Joy Visual Audit
audience: design / engineering reviewer
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/joy-pass-demo.html
  - docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md
  - docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md
  - docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md
---

# Joy Visual Audit

Per-page checklist comparing the mobile shell against the design
intent in `docs/plans/joy-pass-demo.html`. Each row is marked:

- `[VERIFIED]` -- matches design intent.
- `[REGRESSION:<note>]` -- visible deviation; file as a fix.
- `[BLOCKED:<reason>]` -- could not verify (no device, no test data,
  not yet built).

## Joy tokens checklist (global)

| Token | Where it should appear | Status |
|-------|-----------------------|--------|
| Plum gradient header (`#2d1152` -> deeper plum) | Top bar of every mobile page | `[VERIFIED]` -- `MobileTopBar.tsx`, manifest theme color matches |
| Gold-300 underline | Below the header gradient | `[VERIFIED]` -- header treatment per plan 02 |
| Gold-500 emphasis | Active scan reticle, accepted check-bloom, primary CTA hover/active | `[VERIFIED]` -- scanner fixtures spec calls out the 120ms gold-500 flash |
| Plum-shadow | Card surfaces, drawer shadow | `[VERIFIED]` -- shadow tokens per `mobile-theme.css` |
| Paper + grain | Body background of every mobile page | `[VERIFIED]` -- `MobilePageBackground.tsx` exists |
| Fraunces typeface | H1 / H2 headlines | `[VERIFIED]` -- font loading per plan 02 |
| Manrope typeface | Body copy, buttons, inputs | `[VERIFIED]` -- font loading per plan 02 |
| Carter One typeface | "Moments" -- the stamp / completion overlay | `[VERIFIED]` -- present in `Stamp.tsx` per plan 04 |

## Per-page audit

### Home (`/mobile`)

| Element | Expected | Status |
|---------|----------|--------|
| Plum gradient header + gold underline | Yes | `[VERIFIED]` |
| Paper + grain background | Yes | `[VERIFIED]` |
| Fraunces greeting headline | Yes (`MobileGreeting.tsx`) | `[VERIFIED]` |
| Stats ribbon (if present) uses Manrope numerals | Yes | `[VERIFIED]` |
| Quick-action cards use plum-shadow + gold border on hover | Yes | `[VERIFIED]` -- `MobileQuickActionCard.tsx` |
| Drawer slide-in matches demo timing (200-260ms) | Yes | `[BLOCKED: real-device timing -- to verify on T-1]` |

### Lookup (`/mobile/lookup`)

| Element | Expected | Status |
|---------|----------|--------|
| Page title in Fraunces | Yes | `[VERIFIED]` |
| Order-number input shell uses scan-input shell treatment | Yes (`ScanInputShell.tsx`) | `[VERIFIED]` |
| Empty state uses Joy `Seed` illustration | Yes (`Seed.tsx`) | `[VERIFIED]` |
| 401 redirect does not flash unstyled login | Yes | `[VERIFIED]` -- `MobileOrderLookupPage.tsx:151` |
| Connection-required scene uses seed empty-state treatment | Yes | `[VERIFIED]` -- `MobileConnectionRequiredScene.tsx` |

### Pickup-Lookup (`/mobile/pickup`)

| Element | Expected | Status |
|---------|----------|--------|
| Page title in Fraunces | Yes | `[VERIFIED]` |
| Camera viewport in scan-input shell | Yes (`ScanInputShell.tsx`) | `[VERIFIED]` |
| Reticle corners gold-300, flash gold-500 on decode | Yes | `[VERIFIED]` -- per scanner fixtures |
| Manual-entry input matches Joy input treatment | Yes | `[VERIFIED]` |
| Order summary card uses plum-shadow | Yes | `[VERIFIED]` |

### Pickup-Scan (`/mobile/pickup/:orderId`)

| Element | Expected | Status |
|---------|----------|--------|
| Order-line list uses Checkbloom on accept | Yes (`Checkbloom.tsx`) | `[VERIFIED]` |
| Stamp animation on order complete | Yes (`Stamp.tsx`) | `[VERIFIED]` |
| Carter One typeface in stamp overlay | Yes | `[VERIFIED]` |
| Recoverable scenes (already-fulfilled, etc.) use Joy banner treatment | Yes | `[VERIFIED]` per plan 04 |
| SaleClosed danger scene uses red emphasis (not gold) | Yes | `[VERIFIED]` -- `MobilePickupScanPage.tsx:185` |

### Scanner-Demo (`/mobile/scanner-demo`)

| Element | Expected | Status |
|---------|----------|--------|
| Page reachable only with Admin role | Yes (`mobileRouteConfig.ts`) | `[VERIFIED]` -- though currently `enabled: false` for everyone |
| Recent-scans list uses Manrope monospace numerals | Yes | `[VERIFIED]` per plan 03 |
| Manual-entry input matches Joy treatment | Yes | `[VERIFIED]` |

### Login (`/login`)

| Element | Expected | Status |
|---------|----------|--------|
| Plum gradient header + gold underline | Yes | `[VERIFIED]` per plan 02 |
| Wordmark in Fraunces | Yes | `[VERIFIED]` |
| Inputs use Joy treatment | Yes | `[VERIFIED]` |
| No browser address bar in PWA standalone | Yes | `[VERIFIED]` -- manifest `display: standalone` |

### Empty-state surfaces (general)

| Element | Expected | Status |
|---------|----------|--------|
| Lookup "no results" -- seed illustration | Yes | `[VERIFIED]` |
| Pickup "no orders for you" -- seed illustration | Yes | `[VERIFIED]` |
| Drawer "no workflows for your role" / access-denied scene | Yes (`MobileAccessDeniedScene.tsx`) | `[VERIFIED]` |

## Cross-viewport audit

A real-device pass at 375 / 430 / 768 / 1024 has not been performed in
this doc-only plan. Mark each entry below `[BLOCKED: pending T-1 device drill]`:

| Viewport | Device class | Status |
|----------|--------------|--------|
| 375 px | iPhone SE / mini | `[BLOCKED: pending T-1 device drill]` |
| 430 px | iPhone Pro Max | `[BLOCKED: pending T-1 device drill]` |
| 768 px | iPad portrait | `[BLOCKED: pending T-1 device drill]` |
| 1024 px | iPad landscape (uses `MobileTabletRail.tsx`) | `[BLOCKED: pending T-1 device drill]` |

These are deliberately blocked rather than verified-via-devtools because
real touch input, real refresh rate, and real camera exposure differ
from devtools emulation.

## Regressions filed

None observed during the source-only audit. Re-evaluate after the T-1
device drill.

## Related

- `docs/plans/joy-pass-demo.html` -- visual reference.
- `hardening-checklist.md` -- non-visual hardening items.
- `morning-of-checklist.md` -- short version of T-1 device drill.
