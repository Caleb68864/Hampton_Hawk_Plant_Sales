---
scenario_id: "EP-04"
title: "Scan barcode - already fulfilled"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-04: Scan barcode - already fulfilled

## Description
Verifies that scanning a barcode for an OrderLine where QtyFulfilled already equals QtyOrdered returns an "AlreadyFulfilled" result and does not change inventory.

## Preconditions
- An Order exists with status InProgress and at least one OrderLine
- The OrderLine has QtyOrdered=2 and QtyFulfilled=2 (fully fulfilled)
- The OrderLine's PlantCatalog has barcode "TEST-001"
- Inventory for that PlantCatalog has OnHandQty >= 1

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=2, QtyFulfilled=2), Order.Status=InProgress
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains `result: "AlreadyFulfilled"`
5. Verify Inventory.OnHandQty remains 10 (unchanged)
6. Verify OrderLine.QtyFulfilled remains 2 (unchanged)
7. Verify a FulfillmentEvent was created with Result=AlreadyFulfilled

## Expected Results
- Response: `{ success: true, data: { result: "AlreadyFulfilled", ... } }`
- Inventory.OnHandQty = 10 (unchanged)
- OrderLine.QtyFulfilled = 2 (unchanged)
- FulfillmentEvent created with Result=AlreadyFulfilled

## Execution Tool
bash -- `cd api && dotnet test --filter "EP04_ScanBarcode_AlreadyFulfilled"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, no inventory change occurred, QtyFulfilled did not exceed QtyOrdered
- **Fail:** Any assertion fails, or inventory was decremented despite the line being fully fulfilled
