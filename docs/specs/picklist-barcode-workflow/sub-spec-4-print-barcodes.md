---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-01']
master_spec: "../2026-04-25-picklist-barcode-workflow.md"
title: "Print pages -- render pick-list barcode"
---

# SS-04: Print pages render pick-list barcode

## Scope
Update existing summary print pages to include the entity's `PicklistBarcode` (`PLB-...` or `PLS-...`) as a Code128 barcode.

## Files to Touch
- `web/src/pages/print/PrintCheatsheetPickup.tsx` (modify if customer-summary lives here)
- `web/src/pages/print/PrintSellerPacketPage.tsx` (modify -- render PLS- barcode in header)
- Any related customer pick-list summary print page

## Patterns to Follow
- Existing barcode rendering on `PrintOrderBarcodeRollPage.tsx` and `PrintPlantLabelsPage.tsx` -- they already use a Code128 component.

## Implementation Steps

1. Read existing print pages to identify where the entity object is fetched and rendered.
2. Ensure the entity fetch includes `PicklistBarcode` (it should -- the API returns full DTOs).
3. Add a barcode block to each pick-list summary header showing the `PicklistBarcode` text below the barcode glyph.
4. `npm run build` clean.
5. Manual: print a seller summary page; barcode is scannable; value matches `Seller.PicklistBarcode`.

## Interface Contracts

### Provides
- None.

### Requires
- From SS-01: `Customer.PicklistBarcode` and `Seller.PicklistBarcode` are present in the API responses.

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Seller packet page references PicklistBarcode | [STRUCTURAL] | `grep -q "picklistBarcode\\|PicklistBarcode" web/src/pages/print/PrintSellerPacketPage.tsx \|\| (echo "FAIL: seller packet page does not render PicklistBarcode" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
