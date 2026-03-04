---
scenario_id: "DB-04"
title: "Fulfillment event chain integrity across scan-undo-scan-complete sequence"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - concurrency
---

# Scenario DB-04: Fulfillment event chain integrity across scan-undo-scan-complete sequence

## Description
Executes a full fulfillment lifecycle sequence -- scan (Accepted), scan (Accepted), undo, scan (Accepted), complete -- and verifies the FulfillmentEvent chain is intact. The test confirms that exactly 5 total events are created (including the soft-deleted one from the undo), the undo event references the correct original event, timestamps are monotonically increasing, and final inventory and QtyFulfilled counts are consistent with the net operations performed.

## Preconditions
- A PlantCatalog entry exists with barcode "CHAIN-001"
- Inventory for that PlantCatalog has `OnHandQty = 10`
- A Customer and Order exist with status `Open`
- The Order has one OrderLine referencing the PlantCatalog with `QtyOrdered = 2`, `QtyFulfilled = 0`
- No prior FulfillmentEvents exist for this order

## Steps

1. **Seed test data:** Create PlantCatalog (barcode "CHAIN-001"), Inventory (`OnHandQty = 10`), Customer, Order (status `Open`), and OrderLine (`QtyOrdered = 2`, `QtyFulfilled = 0`).

2. **Step A -- First scan:** Call `ScanAsync(orderId, "CHAIN-001")`.
   - Assert `Result == Accepted`
   - Assert `Line.QtyFulfilled == 1`, `Line.QtyRemaining == 1`
   - Record the timestamp of the FulfillmentEvent created (Event 1)

3. **Step B -- Second scan:** Call `ScanAsync(orderId, "CHAIN-001")`.
   - Assert `Result == Accepted`
   - Assert `Line.QtyFulfilled == 2`, `Line.QtyRemaining == 0`
   - Record the timestamp of the FulfillmentEvent created (Event 2)

4. **Step C -- Undo last scan:** Call `UndoLastScanAsync(orderId, "Scanned wrong item", "TestOperator")`.
   - Assert `Result == Accepted`
   - Assert `Line.QtyFulfilled == 1`, `Line.QtyRemaining == 1`
   - This creates two state changes: Event 2 gets `DeletedAt` set (soft-deleted), and a new undo event is created (Event 3)
   - Record the timestamp of Event 3

5. **Step D -- Third scan:** Call `ScanAsync(orderId, "CHAIN-001")`.
   - Assert `Result == Accepted`
   - Assert `Line.QtyFulfilled == 2`, `Line.QtyRemaining == 0`
   - Record the timestamp of the FulfillmentEvent created (Event 4)

6. **Step E -- Complete order:** Call `CompleteOrderAsync(orderId)`.
   - Assert returns `true`
   - Reload Order and assert `Status == OrderStatus.Complete`

7. **Verify event chain -- total count:** Query ALL FulfillmentEvents for the order using `.IgnoreQueryFilters()` (to include soft-deleted). Assert exactly 5 events total:
   - Event 1: `Result == Accepted` (first scan), `DeletedAt == null`
   - Event 2: `Result == Accepted` (second scan), `DeletedAt != null` (soft-deleted by undo)
   - Event 3: `Result == Accepted` (undo event), `DeletedAt == null`, Message contains "UNDO:"
   - Event 4: `Result == Accepted` (third scan), `DeletedAt == null`
   - Event 5: No additional event from CompleteOrder (it only changes Order.Status)

   Note: CompleteOrderAsync does not create a FulfillmentEvent, so total is 4 events (not 5). Correction: the 4 events are Event 1, Event 2, Event 3 (undo), and Event 4. Verify exactly 4 FulfillmentEvents total.

8. **Verify undo references correct event:** Event 2 (the second scan) must have `DeletedAt != null`. Event 3 (the undo) must have `Message` containing "UNDO:" and reference the same `PlantCatalogId` and `Barcode` as Event 2.

9. **Verify monotonically increasing timestamps:** Sort all 4 events by `CreatedAt` ascending. Assert each event's `CreatedAt` is strictly greater than or equal to the previous event's `CreatedAt`. The ordering must be: Event 1 <= Event 2 <= Event 3 <= Event 4.

10. **Verify final inventory:** Reload Inventory and assert `OnHandQty == 8`. Net operations: -1 (scan) -1 (scan) +1 (undo) -1 (scan) = -2 from starting 10.

11. **Verify final OrderLine:** Reload OrderLine and assert `QtyFulfilled == 2`, matching `QtyOrdered == 2`.

12. **Verify non-deleted event count:** Query FulfillmentEvents without `.IgnoreQueryFilters()`. Assert exactly 3 non-deleted events (Event 1, Event 3 undo, Event 4).

## Expected Results
- 4 total FulfillmentEvents exist (including the soft-deleted one)
- 3 non-deleted FulfillmentEvents exist (Event 2 is soft-deleted)
- Event 2 has `DeletedAt != null` (soft-deleted by the undo operation)
- Event 3 (undo) has `Message` containing "UNDO:" and shares `PlantCatalogId` and `Barcode` with Event 2
- All event `CreatedAt` timestamps are monotonically non-decreasing
- `Inventory.OnHandQty == 8` (10 - 1 - 1 + 1 - 1)
- `OrderLine.QtyFulfilled == 2`
- `Order.Status == Complete`

## Execution Tool
bash -- `cd api && dotnet test --filter "DB04_FulfillmentEventChain_Integrity"`

## Pass / Fail Criteria
- **Pass:** All 4 events are present with correct Results and DeletedAt states, the undo event references the correct original event, timestamps are monotonically non-decreasing, final OnHandQty is 8, QtyFulfilled is 2, and order status is Complete
- **Fail:** Event count is wrong, undo event does not reference the correct original scan, timestamps are out of order, inventory or fulfillment counts are inconsistent, or order cannot be completed
