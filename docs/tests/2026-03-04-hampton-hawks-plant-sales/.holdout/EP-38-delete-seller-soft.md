---
scenario_id: "EP-38"
title: "Soft Delete Seller"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - sellers
  - soft-delete
---

## Description

Verify that `DELETE /api/sellers/{id}` performs a soft delete by setting `DeletedAt`, and that the record is excluded from default queries.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Seller` entity and related services are registered in the DI container.
- No pre-existing seller records exist in the database.

## Steps

1. **Seed test data:** Insert 2 sellers into the database:
   - Seller A: `{ displayName: "Ethan Brooks", firstName: "Ethan", lastName: "Brooks", grade: "5th", teacher: "Ms. Hall", notes: "" }`
   - Seller B: `{ displayName: "Mia Lopez", firstName: "Mia", lastName: "Lopez", grade: "4th", teacher: "Mr. Clark", notes: "" }`

2. **Send delete request:** `DELETE /api/sellers/{sellerA.id}` with required admin headers (`X-Admin-Pin`, `X-Admin-Reason`).

3. **Verify soft delete response:** Assert `success: true`.

4. **Verify DeletedAt set:** Query the database directly (bypassing query filters via `.IgnoreQueryFilters()`) for Seller A. Assert:
   - `DeletedAt` is not null
   - `DeletedAt` is a recent timestamp

5. **Verify excluded from default GET:** Send `GET /api/sellers`. Assert that only Seller B is returned (1 result). Seller A should not appear.

6. **Verify included with includeDeleted:** Send `GET /api/sellers?includeDeleted=true`. Assert that both Seller A and Seller B are returned (2 results).

## Expected Results

- `DELETE /api/sellers/{id}` returns `ApiResponse<T>` with `success: true`.
- The seller's `DeletedAt` field is set to a non-null timestamp.
- Default `GET /api/sellers` excludes the soft-deleted seller.
- `GET /api/sellers?includeDeleted=true` includes the soft-deleted seller.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP38"
```

## Pass/Fail Criteria

- **Pass:** `DeletedAt` is set, the seller is excluded from default queries, and it is included when `includeDeleted=true`.
- **Fail:** `DeletedAt` is null after deletion, the seller still appears in default queries, or it is missing from `includeDeleted=true` queries.
