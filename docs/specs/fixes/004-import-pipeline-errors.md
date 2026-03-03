---
title: "Fix: Import Pipeline Error Handling and Batch Counts"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: high
failing_scenarios: [EP-06, EP-07, EP-08, SR-18]
tags:
  - fix
  - import
  - high
---

# Fix: Import Pipeline Error Handling and Batch Counts

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: HIGH
- Failing Scenarios: EP-06, EP-07, EP-08, SR-18

## Outcome
CSV imports gracefully handle unknown SKUs and duplicate entries by creating `ImportIssue` records and continuing. Batch `importedCount` and `skippedCount` are updated correctly. Order import correctly parses `QtyOrdered` from CSV. All imports return HTTP 200 with accurate counts.

## Context
Four related bugs in the import pipeline:

1. **Double SaveChangesAsync in ImportService.cs** -- The service calls `SaveChangesAsync()` after the handler, which throws an exception (likely FK/constraint issue when ImportIssue records are involved). This causes all imports with any problem rows to return 500.
2. **Batch counts never updated** -- `importedCount` and `skippedCount` remain 0 because the exception rolls back or prevents the count update.
3. **No graceful skip for unknown/duplicate SKUs** -- Instead of creating an `ImportIssue` and continuing, the import throws an unhandled DB exception.
4. **QtyOrdered not parsed in order CSV** -- The `QtyOrdered` column value is ignored; all order lines default to qty=1.
5. **CRITICAL: ToDictionaryAsync crash in OrderImportHandler.cs** -- Lines 33-40 use `ToDictionaryAsync(c => c.DisplayName, ...)` for both customers and sellers. If any two customers (or sellers) share the same `DisplayName`, this throws `ArgumentException: "An item with the same key has already been added"` and crashes the entire order import with a 500 error. This must be changed to `ToLookup`, `GroupBy`, or use `.DistinctBy()` before building the dictionary.

## Requirements
- Import handlers must catch duplicate/unknown SKU errors per-row and create `ImportIssue` records
- `ImportService.cs` must not double-call `SaveChangesAsync` (remove the redundant call or restructure)
- Batch `importedCount` and `skippedCount` must reflect actual processed/skipped row counts
- Order CSV import must parse the `QtyOrdered` column and use it for `qtyOrdered` on order lines
- Imports with some bad rows return HTTP 200 with accurate counts (not 500)
- `GET /api/import/batches/{id}/issues` returns the created `ImportIssue` records

## Sub-Specs

### 1. Fix ImportService Double SaveChanges
**Scope:** Remove the redundant `SaveChangesAsync` call in `ImportService.cs` that conflicts with the handler's save.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportService.cs`
**Acceptance criteria:**
- Import with all valid rows returns HTTP 200 with correct importedCount
- Import with mixed valid/invalid rows returns HTTP 200 (not 500)
- Batch counts are updated correctly
**Dependencies:** none

### 2. Add Per-Row Error Handling to Import Handlers
**Scope:** Wrap each row's processing in try-catch. On duplicate/unknown SKU, create an `ImportIssue` record and increment `skippedCount` instead of throwing.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/PlantImportHandler.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/InventoryImportHandler.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderImportHandler.cs`
**Acceptance criteria:**
- Plant import with duplicate SKU: 3 imported, 1 skipped, 1 ImportIssue created with type "DuplicateSku"
- Inventory import with unknown SKU: valid rows imported, unknown rows skipped with ImportIssue type "UnknownSku"
- Order import with unknown SKU: valid orders created, unknown SKU rows skipped with ImportIssue
- `GET /api/import/batches/{id}/issues` returns the issue records
**Dependencies:** 1

### 3. Fix QtyOrdered CSV Parsing in Order Import
**Scope:** Parse the `QtyOrdered` column from the order CSV and use it when creating order lines.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderImportHandler.cs`
**Acceptance criteria:**
- CSV row with `QtyOrdered=2` creates an order line with `qtyOrdered=2` (not 1)
- CSV row with `QtyOrdered=3` creates an order line with `qtyOrdered=3`
- Missing or invalid QtyOrdered defaults to 1
**Dependencies:** 1

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-06`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-07`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-08`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-18`
