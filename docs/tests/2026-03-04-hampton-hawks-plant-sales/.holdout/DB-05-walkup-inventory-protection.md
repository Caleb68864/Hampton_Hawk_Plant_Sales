---
scenario_id: "DB-05"
title: "InventoryProtectionService walk-up availability calculation"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - data
---

# Scenario DB-05: InventoryProtectionService walk-up availability calculation

## Description
Tests the `IInventoryProtectionService` directly (unit/integration level) to verify the core availability formula. With OnHandQty=10 and multiple preorders with unfulfilled quantities summing to 6, `AvailableForWalkup` should be 4. Cancelled orders must be excluded from the calculation.

## Preconditions
- EF Core InMemory or test database available
- TestDataBuilder and MockDbContextFactory configured
- Steps must run in order

## Steps

1. Build test data using TestDataBuilder:
   - Create a plant `PlantA` with `IsActive=true`.
   - Create an Inventory record for `PlantA` with `OnHandQty=10`.
   - Create Customer A and Customer B.
2. Create three non-walk-up preorder orders:
   - Order 1 (Status=Open): one line for `PlantA` with `QtyOrdered=3, QtyFulfilled=0` (unfulfilled=3).
   - Order 2 (Status=InProgress): one line for `PlantA` with `QtyOrdered=4, QtyFulfilled=1` (unfulfilled=3).
   - Order 3 (Status=Cancelled): one line for `PlantA` with `QtyOrdered=5, QtyFulfilled=0` (unfulfilled=5, but cancelled).
3. Call `GetAvailableForWalkupAsync(PlantA.Id)` on the service.
4. Assert the result equals `4` (10 on-hand - 6 unfulfilled from non-cancelled orders).
5. Call `GetAllAvailabilityAsync()` on the service.
6. Find the entry for `PlantA` in the returned list.
7. Assert `OnHandQty` equals `10`.
8. Assert `PreorderRemaining` equals `6`.
9. Assert `AvailableForWalkup` equals `4`.
10. Call `ValidateWalkupLineAsync(PlantA.Id, requestedQty: 4)`.
11. Assert `Allowed` is `true` and `Available` is `4`.
12. Call `ValidateWalkupLineAsync(PlantA.Id, requestedQty: 5)`.
13. Assert `Allowed` is `false` and `ErrorMessage` is non-null.

## Expected Results
- `GetAvailableForWalkupAsync` returns `4`
- `GetAllAvailabilityAsync` returns `AvailableForWalkup=4`, `PreorderRemaining=6`, `OnHandQty=10`
- Cancelled order (Order 3) is excluded from the sum
- `ValidateWalkupLineAsync` allows qty=4 but rejects qty=5

## Execution Tool
bash -- `cd api && dotnet test --filter "DB05_WalkUpInventoryProtection"`

## Pass / Fail Criteria
- **Pass:** Availability is 4, cancelled orders are excluded, validation correctly allows/rejects requests at the boundary.
- **Fail:** Cancelled orders are included in the sum, availability is not 4, or validation boundary is incorrect.
