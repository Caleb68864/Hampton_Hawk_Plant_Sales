---
date: 2026-04-13
topic: "Walk-up fix + barcode/label improvements + order barcode roll"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-13
tags:
  - design
  - walkup-barcode-fixes
---

# Walk-Up + Barcode/Label Fixes — Design

## Summary
Client-reported fixes: (1) walk-up screen has a dead URL somewhere in its flow, (2) plant-label barcodes aren't reliably scannable on small thermal labels, (3) label layout needs 75% SKU / 25% Name split, and (4) need a roll-printable sheet of the order-number barcode so staff can sticker existing printed picker sheets.

Scope: **frontend only**. No API, EF, or database changes. Plant entity keeps its existing `sku` column; padding and normalization happen at render/scan time in the web tier.

## Approach Selected
Zero-pad SKUs to 12 digits and render as CODE128 (auto subset-C, densest numeric mode) instead of concatenating SKU+Name. Rewrite the plant label to a flex-row with SKU-dominant left column. Add a new roll-mode print page for the order-number barcode. Walk-up "dead URL" is carved out (see Scope Boundaries).

## Scope Boundaries

**In scope (this plan):**
- Barcode encoding change (zero-pad to 12 digits, CODE128 via jsbarcode)
- Plant label layout rewrite (75/25 split)
- New order-barcode roll print page + button on order detail
- Scanner input normalization across all web scan surfaces

**Out of scope — deferred:**
- **Walk-up dead URL fix.** Client to reproduce and name the failing button/route. Track as a separate ticket once reproduced; do NOT bundle into this spec. The implementing agent must not attempt to "guess-fix" walk-up navigation.

## Architecture

Pure frontend work plus one shared helper. No schema changes; SKU stays as stored, padding happens at barcode render time. Scanner input normalization strips leading zeros so padded, unpadded, and legacy-short codes all resolve to the same plant.

```
  plant.sku (e.g. "101")
        │
        ▼
  buildPlantBarcode() ──► "000000000101" ──► jsbarcode CODE128 ──► dense SVG
                                                                         │
  scanner input ──► normalizeScannedBarcode() ──► "101" ──► sku match ◄──┘
  (padded OR legacy short form — both work)
```

## Components

**`web/src/utils/barcode.ts`** (new)
- `buildPlantBarcode(sku: string): string` — `sku.trim().padStart(12, '0')`. Returns `'000000000000'` for empty/whitespace input.
- `normalizeScannedBarcode(raw: string): string` — `raw.trim().replace(/^0+/, '') || '0'`. Accepts padded CODE128 output and legacy short SKUs interchangeably.
- Export unit tests alongside (co-located `.test.ts`).

**`web/src/components/print/PlantLabel.tsx`** (rewrite)
- Flex row container, 2" × 1", no border in print.
- **Left 75%** (1.5"): SKU column — human-readable SKU on top (bold, ~22pt), jsbarcode CODE128 SVG below, filling remaining height.
- **Right 25%** (0.5"): Name column — name + optional variant, 8pt, word-wrap, vertical-center.
- Owns: layout + rendering. Does NOT own: data fetching, page chrome, count logic.

**`web/src/components/print/PlantLabelBarcode.tsx`** (replace body)
- Replace custom bar-pattern generator with `jsbarcode` CODE128:
  - `format: 'CODE128'`
  - `width: 1.6` (SVG unit per narrow bar — tuned so 12-digit symbol fits in ~1.35" with quiet zones)
  - `height: 38` (SVG units)
  - `margin: 0` (parent provides quiet zone padding ≥ 0.1" each side via CSS)
  - `displayValue: false`
- Keep the same component signature `({ value })` so the plant label swap is drop-in.

**`web/src/pages/print/PrintPlantLabelsPage.tsx`** (update)
- Delete inline `PlantLabel`; import shared one from `components/print/PlantLabel`.
- Feed `buildPlantBarcode(plant.sku)` as the label's barcode value.
- Keep existing density/count/preset UI unchanged.

**`web/src/components/print/OrderNumberBarcode.tsx`** (add variant)
- Current usage wraps the barcode in a bordered card. Add prop `variant?: 'card' | 'bare'` (default `'card'` — preserves existing call sites in pickup/order print pages).
- `'bare'` variant: render only the `<svg>` + monospace order-number caption, no card chrome, filling the parent. Used by the roll page.

**`web/src/pages/print/PrintOrderBarcodeRollPage.tsx`** (new) — route `/print/order-barcodes/:orderId`
- Loads order via `ordersApi.getById(orderId)`; renders N copies of `<OrderNumberBarcode value={order.orderNumber} variant="bare" />` at 2" × 1".
- Print CSS: `@page { size: 2in 1in; margin: 0 }`, each label wrapped in a `div` with `break-after: page; page-break-after: always` (last child resets).
- On-screen preview stacks vertically with gap; print emits one label per page.
- Count control: numeric input + presets 10/20/40/80, default 10. URL param `?count=N`.
- Toolbar: back button, count selector, print hint ("100% scale, no fit-to-page").

**`web/src/pages/orders/OrderDetailPage.tsx`** (new button)
- Add "Print Barcode Stickers (Roll)" link next to existing print actions → `/print/order-barcodes/{order.id}?count=10`.

**`web/src/App.tsx`** (new route)
- Register `/print/order-barcodes/:orderId` → `PrintOrderBarcodeRollPage`.

**Scanner normalization sweep** — apply `normalizeScannedBarcode` to the scan-entry path (not to display/search text):
- `web/src/hooks/useScanWorkflow.ts` (primary pickup/fulfill scanner)
- `web/src/components/pickup/ScanInput.tsx` (if it forwards raw input)
- `web/src/components/shared/GlobalQuickFind.tsx` + `globalQuickFindMatch.ts`
- `web/src/components/shared/QuickFindOverlay.tsx`
- `web/src/pages/walkup/WalkUpNewOrderPage.tsx` (`scorePlantMatch` — match against both normalized and raw forms)
- `web/src/pages/orders/NewOrderPage.tsx` (plant-lookup path only)

Normalization rule: compare `normalizeScannedBarcode(input) === plant.sku` as an additional match candidate; do not remove existing name/SKU substring matching.

## Data Flow

**Label print:**
`PrintPlantLabelsPage` → fetch plants → for each plant: render shared `PlantLabel` → `PlantLabel` calls `buildPlantBarcode(plant.sku)` → `PlantLabelBarcode` feeds padded value into `jsbarcode` → dense CODE128 SVG.

**Scan:**
Scanner reads padded value (`000000000101`) → keystroke event → existing scan handler → `normalizeScannedBarcode` → `"101"` → lookup by `plant.sku`. Legacy stickers with bare `"101"` still scan because the normalizer is idempotent on short input.

**Order barcode roll:**
`PrintOrderBarcodeRollPage` → `ordersApi.getById(orderId)` → render N × `<OrderNumberBarcode variant="bare" value={orderNumber} />` → browser print dialog → roll printer advances one label per page.

## Print Dimensions & Scanability

Target printer: thermal roll, 2" × 1" labels, typical 203 DPI.

- **Label body padding:** 0.08" all sides (existing `.plant-label` pattern).
- **Barcode module (narrow bar) width:** ≥ 0.013" on paper (≈ 2.6 dots at 203 DPI). `jsbarcode width: 1.6` in SVG units against the ~1.35" available left-column width satisfies this for a 12-digit CODE128 symbol.
- **Quiet zone:** ≥ 0.1" left and right of the barcode. Enforced via `.label-barcode-wrap { padding: 0 0.1in }`.
- **Test gate:** before marking implementation complete, print one test roll and verify a handheld scanner reads 10/10 labels at 6" working distance. Record result in PR.

## Error Handling
- **Empty/whitespace SKU:** `buildPlantBarcode` returns `'000000000000'`; human-readable SKU shows `—`. Label still renders (avoids blank mid-roll).
- **jsbarcode render failure:** same fallback pattern as existing `OrderNumberBarcode` — red error text in the barcode slot, label continues to render.
- **Order not found on roll page:** `ErrorBanner` + back link to orders list. No partial render.
- **Legacy short barcode scanned:** normalizer returns the short form unchanged — existing lookup continues to work. Covered by unit test.
- **Count param invalid (negative/NaN):** clamp to minimum 1 via `parsePositiveInteger` (existing helper pattern from `PrintPlantLabelsPage`).

## Commander's Intent

**Desired End State:** A user can:
1. Open any plant-label print page, and every label renders a scannable CODE128 barcode of the padded SKU, 75% SKU-dominant layout.
2. Open an order and click "Print Barcode Stickers (Roll)" to print N labels of the order-number barcode, one per roll page.
3. Scan either a new padded barcode or a legacy short barcode and have the existing scan handlers resolve the correct plant.
4. A test roll of 10 plant labels scans 10/10 with a handheld scanner at 6" distance.

**Purpose:** Short numeric SKUs produce barcodes too sparse for reliable scans on 2"×1" thermal labels; staff need a roll-friendly order-number sticker for existing paper workflows.

**Constraints (MUST):**
- MUST remain frontend-only (no API, EF, or DB changes).
- MUST preserve scan compatibility with existing printed legacy labels.
- MUST NOT change stored `Plant.sku` or `Plant.barcode` values.
- MUST NOT modify or "fix" walk-up navigation in this spec (see Scope Boundaries).
- MUST use `jsbarcode` with CODE128 for any new barcode rendering (consistency with existing `OrderNumberBarcode`).

**Freedoms (MAY):**
- MAY extract shared print-roll CSS into a utility if duplication emerges between plant-label roll mode and order-barcode roll page.
- MAY choose exact pixel sizes for SKU font / name font as long as they fit within the 75/25 split without overflow on a 2"×1" label.
- MAY add or not add URL-param persistence for roll count (default 10 is fine either way).

## Execution Guidance

**Observe (what to watch during build):**
- `cd web && npm run build` — TypeScript + Vite build clean.
- `cd web && npm test` — any co-located tests (especially for `utils/barcode.ts`).
- Browser print preview of each affected page — visual regression on label layout.

**Orient (conventions to follow):**
- Tailwind v4 utilities; existing `.plant-label` / `@page` print CSS lives in `web/src/styles/print.css`.
- React Router v7 route registration in `web/src/App.tsx`.
- API access via `web/src/api/*` modules (use `ordersApi.getById` — already exists).
- Component files default-export named components; tests co-located as `*.test.ts[x]`.
- No Zustand state needed for any of this.

**Escalate When:**
- A required existing API method is missing (e.g., if `ordersApi.getById` doesn't return `orderNumber`).
- The 12-digit CODE128 at the specified module width demonstrably will not fit within the 1.5" left column after two honest layout attempts.
- Scanner normalization would require changing a backend search endpoint (it shouldn't — this is pure client-side pre-processing).

**Shortcuts (apply without deliberation):**
- Use `jsbarcode` exactly as `OrderNumberBarcode.tsx` does (same options pattern, SVG ref, useEffect).
- Copy the density/count/preset UI pattern verbatim from `PrintPlantLabelsPage` for the new roll page.
- Use the existing `PrintLayout` component wrapper and `parsePositiveInteger` helper pattern.
- Co-locate barcode utility tests as `web/src/utils/barcode.test.ts`.
- **Register the new test file** in `web/package.json`'s `test` script — the project uses `node --test --experimental-strip-types` with an **explicit file list**, not a glob. A new test file that isn't added to that list will be silently skipped.

## Decision Authority

**Agent decides autonomously:**
- Exact font sizes, paddings, and flex ratios within the stated 75/25 split.
- Whether to extract a shared `RollPrintPage` abstraction or duplicate print CSS.
- Unit test cases for `barcode.ts` (beyond the mandatory ones listed in Verification).
- File/folder placement within the already-specified directories.

**Agent recommends, human approves:**
- Any change to `OrderNumberBarcode`'s existing prop signature beyond the additive `variant` prop.
- Any change to the scanner input handling beyond the normalization call.
- Raising the zero-pad width above 12 if physical testing reveals module-width issues.

**Human decides:**
- Whether to start work on the walk-up "dead URL" (out of scope here).
- Whether to backfill legacy printed labels with new padded versions after rollout.
- Rollout order (deploy all at once vs. stage plant labels first, order roll second).

## War-Game Results

**Most likely failure:** Barcode prints but scanner reads inconsistently at working distance.
*Mitigation:* Explicit module-width and quiet-zone specs above; mandatory 10/10 test-roll gate before PR merge.

**Scale stress:** N/A — label count is user-chosen, capped at roll preset (80). No data-volume concern.

**Dependency disruption:** `jsbarcode` already a web dep (used by `OrderNumberBarcode`). If it broke, the existing order-barcode workflow would already be broken — no new dependency risk.

**Legacy-label regression:** Printed stickers with bare "101" continue to scan because `normalizeScannedBarcode` is idempotent on short input. Covered by unit test `normalizes padded and short forms to same value`.

**6-month maintenance:** Barcode logic lives in a single utility file with tests. `PlantLabel` is a small pure component. Roll page mirrors an existing page's structure. A developer unfamiliar with the code can read the utility in 2 minutes and the label component in 5.

## Verification

Acceptance checks the implementing agent must run before marking complete:

- [ ] `cd web && npm run build` passes with no type errors.
- [ ] `cd web && npm test` passes, including new `barcode.test.ts` covering:
  - pads short SKUs to 12 digits
  - returns `'000000000000'` for empty input
  - `normalizeScannedBarcode` strips leading zeros and returns `'0'` for all-zero input
  - padded and legacy forms of the same SKU normalize to the same value
- [ ] Manual: open `/print/plant-labels?ids=<pick 3>` — visually confirm 75/25 layout and barcode renders as CODE128 (not the old decorative pattern).
- [ ] Manual: open `/print/order-barcodes/<orderId>?count=10` — visually confirm 10 pages, one barcode per page.
- [ ] Manual: print one plant-label test roll and one order-barcode test roll; scan every label with a handheld scanner. Target: 10/10 reads at 6" distance. Record result in PR body.
- [ ] Scan a legacy short-barcode sticker (if any physical one exists, or simulate by typing `"101"` into the scan input) and confirm lookup still resolves.

## Rollback

All changes are frontend only and contained to new files plus three edited files (`PlantLabel.tsx`, `PlantLabelBarcode.tsx`, `PrintPlantLabelsPage.tsx`, `OrderNumberBarcode.tsx`, `OrderDetailPage.tsx`, `App.tsx`, `styles/print.css`). Revert the commit and redeploy web — no data migration, no backend state, no stored-barcode rewrites to undo.

## Open Questions

- **Walk-up dead URL** — deferred, awaiting client repro. Not blocking this spec.
- **Existing printed stock** — no action required; legacy barcodes keep scanning via normalizer.

## Approaches Considered

- **SKU+Name concat CODE128** (rejected) — too wide, couples barcodes to name changes, variable width hurts scanner calibration.
- **EAN-13 / UPC-A** (rejected) — requires check digit and SKU numericization ceremony; CODE128-C with 12-digit padding delivers equivalent scanner reliability without it.
- **Keep custom bar-pattern SVG** (rejected) — not a real CODE128 symbol; scanners cannot decode it. Must switch to `jsbarcode`.

## Evaluation Metadata

- Evaluated: 2026-04-13
- Cynefin Domain: Complicated (established patterns; trade-offs required; single correct answer exists)
- Critical Gaps Found: 1 (walk-up dead URL scope — resolved by carving out)
- Important Gaps Found: 6 (chrome-less order barcode variant, print dimensions, scope clarity, normalization sweep completeness, legacy compat test, verification commands — all resolved)
- Suggestions: 2 (rollback plan, backend-vs-frontend clarity — all resolved)
- Evaluation passes: 4 (third evaluate pass verified claims against codebase; caught manual test-file registration requirement in `package.json`)

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-13-walkup-barcode-fixes-design.md`).
- [ ] Client to reproduce walk-up dead URL — separate ticket once named.
- [ ] After implementation: print both test rolls and record scan results in PR.
