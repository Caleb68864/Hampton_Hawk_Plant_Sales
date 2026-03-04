---
scenario_id: "DB-10"
title: "IgnoreQueryFilters returns all records including deleted"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - database
  - soft-delete
---

# Scenario DB-10: IgnoreQueryFilters returns all records including deleted

## Description

Verifies that when `IgnoreQueryFilters()` is used (via the `includeDeleted=true` parameter on service methods), all records are returned including soft-deleted ones. Default queries (without the flag) should exclude soft-deleted records. This is tested across multiple entity types.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- All CRUD services are registered in the DI container.
- No pre-existing records in the database.

## Steps

1. **Seed mixed data across entity types:**
   - Create 3 customers: Customer A (active), Customer B (active), Customer C (will be deleted)
   - Create 3 plants: Plant A (active), Plant B (will be deleted), Plant C (active)
   - Create 2 sellers: Seller A (active), Seller B (will be deleted)

2. **Soft-delete selected entities:**
   - `DELETE /api/customers/{customerCId}`
   - `DELETE /api/plants/{plantBId}`
   - `DELETE /api/sellers/{sellerBId}`

3. **Verify default queries exclude deleted:**
   - `GET /api/customers` returns 2 customers (A, B).
   - `GET /api/plants` returns 2 plants (A, C).
   - `GET /api/sellers` returns 1 seller (A).

4. **Verify IgnoreQueryFilters includes deleted:**
   - `GET /api/customers?includeDeleted=true` returns 3 customers. Customer C has `deletedAt` non-null. Customers A and B have `deletedAt` = null.
   - `GET /api/plants?includeDeleted=true` returns 3 plants. Plant B has `deletedAt` non-null.
   - `GET /api/sellers?includeDeleted=true` returns 2 sellers. Seller B has `deletedAt` non-null.

5. **Verify deleted records have correct timestamps:**
   - For each deleted entity, `deletedAt` is a valid DateTimeOffset.
   - For each active entity, `deletedAt` is null.

6. **Verify counts match:**
   - Default query count + deleted count = includeDeleted query count for each entity type.

## Expected Results

- Default queries return only active (non-deleted) records.
- `includeDeleted=true` queries return all records, both active and deleted.
- Deleted records have a non-null `deletedAt` timestamp.
- Active records have `deletedAt` = null.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~DB10"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- default queries exclude deleted records, `includeDeleted` queries include all records, timestamps are correct across all entity types.
- **Fail:** Any assertion fails -- deleted records appear in default queries, missing from `includeDeleted` queries, or timestamps are incorrect.
