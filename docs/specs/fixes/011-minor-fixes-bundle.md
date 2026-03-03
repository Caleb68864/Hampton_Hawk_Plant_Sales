---
title: "Fix: Minor Issues Bundle (barcodeLockedAt DTO, Print Subtitle)"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: low
failing_scenarios: [SR-16, UI-06]
tags:
  - fix
  - minor
  - low
---

# Fix: Minor Issues Bundle

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: LOW
- Failing Scenarios: SR-16, UI-06

## Outcome
1. `barcodeLockedAt` field is exposed in the PlantResponse DTO.
2. Print order sheet subtitle reads "Customer Order Sheet" instead of "Order Sheet".

## Context
Two minor issues that are quick to fix:

1. **SR-16:** The `BarcodeLockedAt` field exists on the `PlantCatalog` entity and is set by `FulfillmentService` when a barcode is first scanned. However, the `PlantResponse` DTO does not include this field, so it cannot be verified via the public API.

2. **UI-06:** The print order sheet page at `/print/order/{id}` renders the subtitle as "Order Sheet" but the spec expects "Customer Order Sheet".

## Requirements
- `GET /api/plants/{id}` response includes `barcodeLockedAt` (null before first scan, timestamp after)
- Print page subtitle text is "Customer Order Sheet"

## Sub-Specs

### 1. Add barcodeLockedAt to PlantResponse DTO
**Scope:** Map the `BarcodeLockedAt` entity field to the response DTO.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Core/DTOs/PlantDtos.cs`
- Mapping code (AutoMapper profile or manual mapping)
**Acceptance criteria:**
- `GET /api/plants/{id}` before any scan: `barcodeLockedAt: null`
- `GET /api/plants/{id}` after a scan: `barcodeLockedAt: "2026-03-02T..."` (non-null timestamp)
**Dependencies:** none

### 2. Fix Print Order Sheet Subtitle
**Scope:** Change the subtitle text from "Order Sheet" to "Customer Order Sheet".
**Files likely touched:** `web/src/pages/PrintOrderPage.tsx` (or equivalent print page component)
**Acceptance criteria:**
- Navigate to `/print/order/{id}` -> subtitle text is "Customer Order Sheet"
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-16`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario UI-06`
