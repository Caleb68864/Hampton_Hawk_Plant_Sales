---
scenario_id: "EP-07"
title: "Undo last scan"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-07: Undo last scan

## Description
Verifies that after a successful scan, calling undo-last-scan restores inventory, decrements QtyFulfilled, soft-deletes the original FulfillmentEvent, and creates a new undo FulfillmentEvent.

## Preconditions
- An Order exists with status InProgress
- A successful scan has already been performed (OrderLine.QtyFulfilled=1, Inventory.OnHandQty=9)
- A FulfillmentEvent with Result=Accepted exists for this order

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }` to create an accepted scan
3. Verify Inventory.OnHandQty=9 and OrderLine.QtyFulfilled=1 after the scan
4. Call `POST /api/orders/{orderId}/undo-last-scan`
5. Assert response status 200 with `success: true`
6. Verify Inventory.OnHandQty restored to 10
7. Verify OrderLine.QtyFulfilled decremented back to 0
8. Verify the original FulfillmentEvent (Result=Accepted) is soft-deleted (DeletedAt is set)
9. Verify a new FulfillmentEvent was created representing the undo operation

## Expected Results
- Response: `{ success: true, data: { ... } }`
- Inventory.OnHandQty = 10 (restored)
- OrderLine.QtyFulfilled = 0 (decremented)
- Original FulfillmentEvent soft-deleted (DeletedAt != null)
- New undo FulfillmentEvent created

## Execution Tool
bash -- `cd api && dotnet test --filter "EP07_UndoLastScan"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, inventory restored, fulfillment decremented, events correctly managed
- **Fail:** Any assertion fails, or inventory/fulfillment not properly reversed, or original event not soft-deleted
