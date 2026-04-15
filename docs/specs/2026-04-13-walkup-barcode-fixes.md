---
date: 2026-04-13
title: Walk-Up + Barcode/Label Fixes
design_doc: docs/plans/2026-04-13-walkup-barcode-fixes-design.md
status: implementing
---

# Walk-Up + Barcode/Label Fixes — Spec

The authoritative design is `docs/plans/2026-04-13-walkup-barcode-fixes-design.md`. This spec indexes sub-specs derived from that plan.

## Outcome
A user can print scannable 75/25 plant labels with zero-padded CODE128 barcodes; print a roll of order-number sticker barcodes from any order; and scan either new padded or legacy short barcodes interchangeably.

## Sub-Specs

1. **Barcode utility + tests** — `web/src/utils/barcode.ts` (+ `.test.ts`), register in `package.json`.
2. **Plant label rewrite** — `PlantLabelBarcode.tsx` (jsbarcode CODE128), `PlantLabel.tsx` (75/25 flex row), `styles/print.css`, `PrintPlantLabelsPage.tsx` uses shared label.
3. **OrderNumberBarcode variant** — add `variant: 'card' | 'bare'` prop.
4. **Order barcode roll page** — new `PrintOrderBarcodeRollPage.tsx`, route in `App.tsx`, button on `OrderDetailPage.tsx`.
5. **Scanner normalization** — `useScanWorkflow.ts` + `globalQuickFindMatch.ts` strip leading zeros before lookup.

## Out of Scope
- Walk-up dead URL (awaiting client repro).
- Any API/EF/DB changes.

## Verification
See plan's Verification section. Key gate: `npm run build` passes, `npm test` passes, visual check of label pages.
