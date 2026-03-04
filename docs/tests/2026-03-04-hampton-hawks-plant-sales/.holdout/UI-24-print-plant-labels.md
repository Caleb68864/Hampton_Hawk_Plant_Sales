---
scenario_id: "UI-24"
title: "Print Plant Labels"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the plant labels print page renders labels with plant name, SKU, and barcode in a print-friendly layout when navigated to with selected plant IDs.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least two plants exist in the database with known IDs, names, SKUs, and barcodes.

## Steps

1. Navigate to `http://localhost:5173/print/labels?plantIds={id1},{id2}` where `{id1}` and `{id2}` are known plant IDs.
2. Wait for the page to fully load and labels to render.
3. Verify that labels are rendered for each selected plant.
4. For each label, verify the plant name is displayed.
5. For each label, verify the SKU is displayed.
6. For each label, verify a barcode representation is displayed (visual barcode or barcode text).
7. Verify the page layout is print-friendly (e.g., appropriate sizing, no extraneous navigation elements visible in print context, or a print-specific stylesheet is applied).
8. Verify no console errors are present.

## Expected Results

- Labels render for each plant ID passed in the URL parameters.
- Each label contains the plant name, SKU, and barcode.
- The layout is optimized for printing (clean, properly sized, no navigation clutter).
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Labels render with plant name, SKU, and barcode for each selected plant, and the layout is print-friendly.
- **Fail:** Labels do not render, any field (name, SKU, barcode) is missing, layout is not print-appropriate, or console errors occur.
