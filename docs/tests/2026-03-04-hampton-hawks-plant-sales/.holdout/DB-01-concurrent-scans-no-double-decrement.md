---
scenario_id: "DB-01"
title: "Concurrent scans do not double-decrement inventory"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - concurrency
---

# Scenario DB-01: Concurrent scans do not double-decrement inventory

## Description
Two simultaneous `ScanAsync` calls for the same barcode against the same order execute concurrently when only one unit of inventory remains. The Serializable transaction isolation level combined with raw SQL `SELECT ... FOR UPDATE` row-level locking must guarantee that only one scan succeeds with `Accepted` while the other receives `OutOfStock` (or retries and then fails). Inventory must never go negative, and QtyFulfilled must not exceed 1.

## Preconditions
- A PlantCatalog entry exists with barcode "CONC-001" and a known `PlantCatalogId`
- An Inventory record exists for that PlantCatalog with `OnHandQty = 1`
- A Customer and Order exist with status `Open`
- The Order has one OrderLine referencing the PlantCatalog with `QtyOrdered = 2`, `QtyFulfilled = 0`
- The database provider is PostgreSQL (relational) so that `FOR UPDATE` and Serializable isolation are exercised
- No other fulfillment activity is in progress for this order

## Steps

1. **Seed test data:** Create PlantCatalog (barcode "CONC-001"), Inventory (`OnHandQty = 1`), Customer, Order (status `Open`), and OrderLine (`QtyOrdered = 2`, `QtyFulfilled = 0`).
2. **Launch two concurrent scans:** Using `Task.WhenAll`, invoke `ScanAsync(orderId, "CONC-001")` twice simultaneously from two separate service instances (or two threads sharing the same DbContext factory).
3. **Collect both results:** Capture the `ScanResponse` from each task.
4. **Assert exactly one Accepted:** Verify that exactly one response has `Result == FulfillmentResult.Accepted`.
5. **Assert the other is OutOfStock or AlreadyFulfilled:** The losing scan must return `FulfillmentResult.OutOfStock` or `FulfillmentResult.AlreadyFulfilled` (the latter occurs if all retry attempts exhaust and the final catch returns `AlreadyFulfilled`).
6. **Reload Inventory from DB:** Query `Inventories` for the PlantCatalog and assert `OnHandQty == 0`.
7. **Reload OrderLine from DB:** Query `OrderLines` for the order + PlantCatalog and assert `QtyFulfilled == 1` (not 2).
8. **Count FulfillmentEvents:** Query `FulfillmentEvents` for the order. Verify exactly one event has `Result == Accepted`. Additional events with `OutOfStock` or `AlreadyFulfilled` are acceptable for the losing scan.
9. **Verify no negative inventory:** Assert `OnHandQty >= 0`.

## Expected Results
- Exactly one scan returns `ScanResponse.Result == Accepted`
- The other scan returns `OutOfStock` or `AlreadyFulfilled`
- `Inventory.OnHandQty == 0` (decremented exactly once)
- `OrderLine.QtyFulfilled == 1` (incremented exactly once)
- Exactly one `FulfillmentEvent` with `Result == Accepted` exists for this order
- No data integrity violations (negative inventory, double fulfillment)

## Execution Tool
bash -- `cd api && dotnet test --filter "DB01_ConcurrentScans_NoDoubleDecrement"`

## Pass / Fail Criteria
- **Pass:** Only one scan succeeds, inventory is decremented exactly once to 0, QtyFulfilled is exactly 1, and no negative inventory occurs
- **Fail:** Both scans return Accepted, OnHandQty goes below 0, QtyFulfilled exceeds 1, or more than one Accepted FulfillmentEvent is recorded
