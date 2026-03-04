---
scenario_id: "EP-33"
title: "Soft Delete Customer"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - customers
  - soft-delete
---

## Description

Verify that `DELETE /api/customers/{id}` performs a soft delete by setting `DeletedAt`, and that the record is excluded from default queries but available when soft-deleted records are requested.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Customer` entity and related services are registered in the DI container.
- No pre-existing customer records exist in the database.

## Steps

1. **Seed test data:** Insert 2 customers into the database:
   - Customer A: `{ displayName: "Eve Adams", firstName: "Eve", lastName: "Adams", phone: "555-0501", email: "eve@example.com", notes: "" }`
   - Customer B: `{ displayName: "Frank Lee", firstName: "Frank", lastName: "Lee", phone: "555-0502", email: "frank@example.com", notes: "" }`

2. **Send delete request:** `DELETE /api/customers/{customerA.id}` with required admin headers (`X-Admin-Pin`, `X-Admin-Reason`).

3. **Verify soft delete response:** Assert `success: true`.

4. **Verify DeletedAt set:** Query the database directly (bypassing query filters via `.IgnoreQueryFilters()`) for Customer A. Assert:
   - `DeletedAt` is not null
   - `DeletedAt` is a recent timestamp

5. **Verify excluded from default GET:** Send `GET /api/customers`. Assert that only Customer B is returned (1 result). Customer A should not appear.

6. **Verify included with includeDeleted:** Send `GET /api/customers?includeDeleted=true`. Assert that both Customer A and Customer B are returned (2 results).

## Expected Results

- `DELETE /api/customers/{id}` returns `ApiResponse<T>` with `success: true`.
- The customer's `DeletedAt` field is set to a non-null timestamp.
- Default `GET /api/customers` excludes the soft-deleted customer.
- `GET /api/customers?includeDeleted=true` includes the soft-deleted customer.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP33"
```

## Pass/Fail Criteria

- **Pass:** `DeletedAt` is set, the customer is excluded from default queries, and it is included when `includeDeleted=true`.
- **Fail:** `DeletedAt` is null after deletion, the customer still appears in default queries, or it is missing from `includeDeleted=true` queries.
