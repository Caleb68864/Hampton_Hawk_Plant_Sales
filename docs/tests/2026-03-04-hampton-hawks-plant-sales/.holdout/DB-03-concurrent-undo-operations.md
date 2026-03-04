---
scenario_id: "DB-03"
title: "Concurrent undo operations do not double-increment inventory"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - concurrency
---

# Scenario DB-03: Concurrent undo operations do not double-increment inventory

## Description
Two simultaneous `UndoLastScanAsync` calls target the same order after a single successful scan. The `FOR UPDATE` row-level locking on the Inventory, OrderLine, and FulfillmentEvent rows must ensure that only one undo succeeds while the other fails (throws `KeyNotFoundException` because the accepted event was already soft-deleted). Inventory must be incremented exactly once, and only one undo FulfillmentEvent must be created.

## Preconditions
- A PlantCatalog entry exists with barcode "UNDO-001"
- Inventory for that PlantCatalog has `OnHandQty = 9` (after a prior scan decremented from 10)
- A Customer and Order exist with status `InProgress`
- The Order has one OrderLine with `QtyOrdered = 3`, `QtyFulfilled = 1` (one unit was already scanned)
- Exactly one `FulfillmentEvent` with `Result == Accepted` exists for this order (the scan that will be undone)
- The database provider is PostgreSQL (relational) so that `FOR UPDATE` locking is exercised

## Steps

1. **Seed test data:** Create PlantCatalog (barcode "UNDO-001"), Inventory (`OnHandQty = 9`), Customer, Order (status `InProgress`), OrderLine (`QtyOrdered = 3`, `QtyFulfilled = 1`), and one FulfillmentEvent (`Result = Accepted`, `PlantCatalogId` set, `DeletedAt = null`).
2. **Launch two concurrent undos:** Using `Task.WhenAll`, invoke `UndoLastScanAsync(orderId, "Duplicate test", "Operator1")` twice simultaneously from two separate service instances sharing the same database.
3. **Collect results and exceptions:** One call should return a successful `ScanResponse` with `Result == Accepted`. The other should throw `KeyNotFoundException` ("No accepted scan found to undo") because the first undo soft-deleted the target event, making it invisible to the second undo's query.
4. **Assert exactly one success:** Verify exactly one of the two tasks completed successfully.
5. **Assert exactly one failure:** Verify exactly one of the two tasks threw `KeyNotFoundException`.
6. **Reload Inventory from DB:** Assert `OnHandQty == 10` (incremented exactly once from 9).
7. **Reload OrderLine from DB:** Assert `QtyFulfilled == 0` (decremented exactly once from 1).
8. **Count FulfillmentEvents:** Query non-deleted events (`DeletedAt == null`) for the order. Verify exactly one undo event exists (its `Message` should contain "UNDO:"). Verify the original Accepted event now has `DeletedAt != null` (soft-deleted).
9. **Verify no double-increment:** Assert `OnHandQty` is exactly 10, not 11.

## Expected Results
- Exactly one undo call succeeds with `ScanResponse.Result == Accepted`
- Exactly one undo call throws `KeyNotFoundException`
- `Inventory.OnHandQty == 10` (incremented exactly once)
- `OrderLine.QtyFulfilled == 0` (decremented exactly once)
- Exactly one undo `FulfillmentEvent` exists (non-deleted) with Message containing "UNDO:"
- The original Accepted `FulfillmentEvent` has `DeletedAt != null` (soft-deleted exactly once)
- No data integrity violations (double-incremented inventory, double-decremented QtyFulfilled)

## Execution Tool
bash -- `cd api && dotnet test --filter "DB03_ConcurrentUndo_NoDoubleIncrement"`

## Pass / Fail Criteria
- **Pass:** Only one undo succeeds, inventory increments exactly once to 10, QtyFulfilled decrements exactly once to 0, and only one undo event is created
- **Fail:** Both undos succeed, OnHandQty exceeds 10, QtyFulfilled goes below 0, or more than one undo FulfillmentEvent is created
