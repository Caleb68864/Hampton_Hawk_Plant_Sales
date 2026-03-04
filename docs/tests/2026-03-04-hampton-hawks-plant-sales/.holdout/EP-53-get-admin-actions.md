---
scenario_id: "EP-53"
title: "Get admin actions with filters"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - admin-actions
---

# Scenario EP-53: Get admin actions with filters

## Description

Verifies that `GET /api/admin-actions` requires the `X-Admin-Pin` header and supports filtering by `orderId`, `entityType`, and `actionType` query parameters. Results should be ordered by `CreatedAt` descending.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IAdminService` and `AdminPinActionFilter` are registered in the DI container.
- The admin PIN is configured.
- Multiple AdminAction records exist in the database with varying entity types and action types.

## Steps

1. **Seed test data:** Insert 4 AdminAction records:
   - Action 1: `{ actionType: "ForceComplete", entityType: "Order", entityId: <orderId1>, reason: "Customer requested" }`
   - Action 2: `{ actionType: "Reset", entityType: "Order", entityId: <orderId1>, reason: "Operator error" }`
   - Action 3: `{ actionType: "SaleClosedToggle", entityType: "Settings", entityId: <settingsId>, reason: "End of day" }`
   - Action 4: `{ actionType: "ForceComplete", entityType: "Order", entityId: <orderId2>, reason: "Missing plant" }`

2. **Send unfiltered request:** `GET /api/admin-actions`
   - Headers: `X-Admin-Pin: <valid_pin>`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert all 4 actions returned:** `data` contains 4 items, ordered by `createdAt` descending.

5. **Assert AdminActionResponse fields for each item:**
   - `id` (valid GUID)
   - `actionType` (non-empty string)
   - `entityType` (non-empty string)
   - `entityId` (valid GUID)
   - `reason` (non-empty string)
   - `createdAt` (valid DateTimeOffset)

6. **Filter by orderId:** `GET /api/admin-actions?orderId={orderId1}`
   - Headers: `X-Admin-Pin: <valid_pin>`
   - Assert 2 results (Actions 1 and 2 for orderId1).

7. **Filter by entityType:** `GET /api/admin-actions?entityType=Settings`
   - Headers: `X-Admin-Pin: <valid_pin>`
   - Assert 1 result (Action 3).

8. **Filter by actionType:** `GET /api/admin-actions?actionType=ForceComplete`
   - Headers: `X-Admin-Pin: <valid_pin>`
   - Assert 2 results (Actions 1 and 4).

9. **Verify without admin PIN:** `GET /api/admin-actions` without `X-Admin-Pin` header. Assert HTTP 403.

## Expected Results

- Unfiltered: all 4 actions returned, ordered by `createdAt` descending.
- Filtered by orderId: only actions for that order.
- Filtered by entityType: only actions for that entity type.
- Filtered by actionType: only actions of that type.
- Without PIN: HTTP 403.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP53"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- filters return correct subsets, ordering is correct, PIN enforcement works.
- **Fail:** Any assertion fails -- wrong filter results, incorrect ordering, or PIN validation bypassed.
