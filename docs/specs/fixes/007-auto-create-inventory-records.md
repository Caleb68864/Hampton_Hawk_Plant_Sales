---
title: "Fix: New Plants Lack Inventory Records"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: high
failing_scenarios: [EP-05]
tags:
  - fix
  - inventory
  - high
---

# Fix: New Plants Lack Inventory Records

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: HIGH
- Failing Scenarios: EP-05

## Outcome
When a plant is created via `POST /api/plants`, an inventory record is automatically created with `onHandQty = 0`. `PUT /api/inventory/{plantId}` works for all plants, not just seeded ones.

## Context
Currently, `PUT /api/inventory/{plantId}` returns 404 "Inventory record not found for this plant" for any plant created via the API. Only pre-seeded plants have inventory records. This forces users to use CSV import to initialize inventory, which is unintuitive.

## Requirements
- `POST /api/plants` automatically creates an `Inventory` record with `onHandQty = 0` for the new plant
- `PUT /api/inventory/{plantId}` succeeds for plants created via API (not just seeded)
- `POST /api/inventory/adjust` also works for API-created plants
- Existing seeded plant inventory is not affected

## Sub-Specs

### 1. Auto-Create Inventory Record on Plant Creation
**Scope:** After creating a plant, create a corresponding inventory record with qty=0.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/PlantService.cs` (create method)
- Or handle in `AppDbContext` via a post-save hook
**Acceptance criteria:**
- Create a plant via POST /api/plants -> GET /api/inventory shows the plant with onHandQty=0
- PUT /api/inventory/{newPlantId} with quantity=50 returns 200 (not 404)
- POST /api/inventory/adjust for the new plant works
- Existing plants and inventory are unaffected
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-05`
