---
title: "Fix: Soft Delete Query Support and DTO Exposure"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: high
failing_scenarios: [EP-11, DB-02, EP-01]
tags:
  - fix
  - soft-delete
  - high
---

# Fix: Soft Delete Query Support and DTO Exposure

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: HIGH
- Failing Scenarios: EP-11, DB-02, EP-01

## Outcome
1. `?includeDeleted=true` on list endpoints bypasses the EF Core global query filter and returns soft-deleted records.
2. Response DTOs include a `deletedAt` field (null for active records, timestamp for deleted).
3. Unique constraints (SKU, barcode) exclude soft-deleted rows, preventing 500 errors when re-creating with a previously soft-deleted SKU/barcode.

## Context
Three related soft-delete issues:

1. **Global query filter never bypassed** -- Entity configurations register `HasQueryFilter(e => e.DeletedAt == null)`. The service `GetAllAsync` methods add a redundant `.Where(c => c.DeletedAt == null)` but never call `.IgnoreQueryFilters()` when `includeDeleted=true`. Soft-deleted records are permanently invisible via API.
2. **deletedAt not in DTOs** -- Response DTOs (PlantResponse, CustomerResponse, etc.) don't include the `DeletedAt` field from the entity.
3. **Unique constraint includes soft-deleted rows** -- The DB unique index on SKU/barcode includes soft-deleted records. Creating a plant with a SKU that was previously soft-deleted hits the unique constraint and throws an unhandled 500.

## Requirements
- Service `GetAllAsync` methods call `.IgnoreQueryFilters()` when `includeDeleted=true` parameter is provided
- Response DTOs include `deletedAt` (nullable DateTimeOffset)
- Unique indexes on SKU and barcode are filtered to exclude `DeletedAt IS NOT NULL` (partial/filtered indexes in PostgreSQL)
- The application-level duplicate check also ignores soft-deleted records
- Direct GET by ID with `?includeDeleted=true` also returns soft-deleted entities

## Sub-Specs

### 1. Bypass Global Query Filter for includeDeleted
**Scope:** Modify service methods to call `.IgnoreQueryFilters()` when the `includeDeleted` parameter is true.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/PlantService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/CustomerService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/SellerService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs`
- Corresponding controllers to accept `includeDeleted` query param
**Acceptance criteria:**
- `GET /api/plants?includeDeleted=true` returns soft-deleted plants
- `GET /api/customers?includeDeleted=true` returns soft-deleted customers
- Default queries (no param) exclude soft-deleted records as before
- Soft-deleted records have a non-null `deletedAt` in the response
**Dependencies:** none

### 2. Add deletedAt to Response DTOs
**Scope:** Add `DeletedAt` property to all response DTOs and map it from the entity.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Core/DTOs/PlantDtos.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/CustomerDtos.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/SellerDtos.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs`
- Mapping profiles or manual mapping code
**Acceptance criteria:**
- Active records show `deletedAt: null`
- Soft-deleted records (via includeDeleted) show `deletedAt: "2026-03-02T..."` timestamp
**Dependencies:** none

### 3. Fix Unique Constraints to Exclude Soft-Deleted
**Scope:** Change unique indexes on SKU and barcode to filtered indexes (`WHERE "DeletedAt" IS NULL`).
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/PlantCatalogConfiguration.cs`
- A new EF migration file
**Acceptance criteria:**
- Creating a plant with a SKU that was previously soft-deleted succeeds (HTTP 200/201)
- Creating a plant with a SKU that is currently active fails (HTTP 400, not 500)
- Same for barcode uniqueness
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-11`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario DB-02`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-01`
