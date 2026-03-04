---
scenario_id: "SR-07"
title: "includeDeleted parameter works on all list endpoints"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - soft-delete
---

# Scenario SR-07: includeDeleted parameter works on all list endpoints

## Description

Verifies that the `includeDeleted=true` query parameter works correctly on all list endpoints that support it. When set, soft-deleted records should be included in the results alongside active records. This validates the architecture rule that `.IgnoreQueryFilters()` is used when `includeDeleted=true`.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- All CRUD services are registered in the DI container.
- No pre-existing records in the database.

## Steps

### Plants

1. **Create 3 plants.** Soft-delete 1.
2. `GET /api/plants` returns 2 items.
3. `GET /api/plants?includeDeleted=true` returns 3 items. The deleted plant has `deletedAt` non-null.

### Customers

4. **Create 3 customers.** Soft-delete 1.
5. `GET /api/customers` returns 2 items.
6. `GET /api/customers?includeDeleted=true` returns 3 items. The deleted customer has `deletedAt` non-null.

### Sellers

7. **Create 3 sellers.** Soft-delete 1.
8. `GET /api/sellers` returns 2 items.
9. `GET /api/sellers?includeDeleted=true` returns 3 items. The deleted seller has `deletedAt` non-null.

### Orders

10. **Create 3 orders.** Soft-delete 1.
11. `GET /api/orders` returns 2 items.
12. `GET /api/orders?includeDeleted=true` returns 3 items. The deleted order has `deletedAt` non-null.

### Verify deleted record fields

13. For each entity type, verify the deleted record in the `includeDeleted` response:
    - `deletedAt` is a valid DateTimeOffset (not null).
    - `createdAt` and `updatedAt` are also present and valid.
    - All other fields are still populated (data is preserved after soft delete).

### Verify includeDeleted=false (explicit)

14. `GET /api/plants?includeDeleted=false` returns 2 items (same as default behavior).

## Expected Results

- Default queries (no `includeDeleted` or `includeDeleted=false`): only active records returned.
- `includeDeleted=true`: all records returned including soft-deleted, with `deletedAt` timestamps.
- Data integrity preserved on soft-deleted records.
- Works consistently across Plants, Customers, Sellers, and Orders.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR07"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- `includeDeleted=true` returns all records with correct `deletedAt` values across all 4 entity types, default behavior excludes deleted.
- **Fail:** Any assertion fails -- `includeDeleted=true` missing deleted records, `deletedAt` null on deleted records, or any endpoint does not support the parameter.
