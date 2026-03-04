---
scenario_id: "DB-02"
title: "Transaction rollback on scan failure preserves inventory"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - concurrency
---

# Scenario DB-02: Transaction rollback on scan failure preserves inventory

## Description
A scan is attempted where the barcode exists in PlantCatalog but the corresponding OrderLine does not belong to the target order (barcode/order mismatch). The service must return `WrongOrder`, the transaction must be rolled back (or never started for the mutation path), inventory must remain unchanged, and no `Accepted` FulfillmentEvent is created. Additionally, on the retry path, `ChangeTracker.Clear()` must be called to prevent stale tracked entities from leaking between attempts.

## Preconditions
- PlantCatalog entry A exists with barcode "ROLLBACK-001" and a known `PlantCatalogId`
- Inventory for PlantCatalog A exists with `OnHandQty = 5`
- A Customer and Order exist with status `Open`
- The Order has one OrderLine referencing a **different** PlantCatalog B (not A) with `QtyOrdered = 3`, `QtyFulfilled = 0`
- No OrderLine exists on this order for PlantCatalog A

## Steps

1. **Seed test data:** Create PlantCatalog A (barcode "ROLLBACK-001"), PlantCatalog B (barcode "OTHER-001"), Inventory for A (`OnHandQty = 5`), Inventory for B (`OnHandQty = 5`), Customer, Order, and one OrderLine referencing PlantCatalog B.
2. **Call ScanAsync:** Invoke `ScanAsync(orderId, "ROLLBACK-001")` -- the barcode matches PlantCatalog A, but no OrderLine for A exists on the order.
3. **Assert WrongOrder result:** Verify the response has `Result == FulfillmentResult.WrongOrder`.
4. **Verify response includes plant info:** Assert `ScanResponse.Plant.Sku` and `ScanResponse.Plant.Name` match PlantCatalog A (the scanned item is identified even though it is wrong for the order).
5. **Reload Inventory A from DB:** Assert `OnHandQty == 5` (unchanged -- no transaction mutated inventory).
6. **Reload Inventory B from DB:** Assert `OnHandQty == 5` (unchanged).
7. **Reload OrderLine from DB:** Assert `QtyFulfilled == 0` (unchanged).
8. **Count FulfillmentEvents:** Query events for the order. Verify exactly one event exists with `Result == WrongOrder`. Verify zero events exist with `Result == Accepted`.
9. **Verify ChangeTracker.Clear() on retry path:** Simulate a `DbUpdateConcurrencyException` on the first attempt (via a mock or by forcing a concurrency conflict). Confirm that after the exception, `ChangeTracker.Clear()` is called before the next retry. On the retry, the service should re-read fresh entities. Verify no stale tracked entities remain from the failed attempt.

## Expected Results
- `ScanResponse.Result == WrongOrder`
- `ScanResponse.Plant` is populated with PlantCatalog A details
- `Inventory.OnHandQty` for PlantCatalog A remains 5
- `Inventory.OnHandQty` for PlantCatalog B remains 5
- `OrderLine.QtyFulfilled` remains 0
- Exactly one `FulfillmentEvent` with `Result == WrongOrder` exists
- Zero `FulfillmentEvent` records with `Result == Accepted` exist
- `ChangeTracker.Clear()` is invoked between retry attempts so no stale entities persist

## Execution Tool
bash -- `cd api && dotnet test --filter "DB02_TransactionRollback_OnScanFailure"`

## Pass / Fail Criteria
- **Pass:** Response is WrongOrder, all inventory and fulfillment quantities are unchanged, no Accepted event exists, and ChangeTracker is cleared on retry
- **Fail:** Inventory is modified, an Accepted event is created, QtyFulfilled changes, or stale entities from a failed attempt leak into a retry
