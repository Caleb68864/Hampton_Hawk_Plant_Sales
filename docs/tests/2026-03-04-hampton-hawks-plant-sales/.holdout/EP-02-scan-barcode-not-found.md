---
scenario_id: "EP-02"
title: "Scan barcode - not found"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-02: Scan barcode - not found

## Description
Verifies that scanning a barcode that does not exist in the PlantCatalog returns a "NotFound" result and makes no changes to inventory or fulfillment state.

## Preconditions
- An Order exists with status Open and at least one OrderLine
- The barcode "NONEXISTENT-999" does not exist in any PlantCatalog record

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "NONEXISTENT-999" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains `result: "NotFound"`
5. Verify Inventory.OnHandQty remains 10 (unchanged)
6. Verify OrderLine.QtyFulfilled remains 0 (unchanged)
7. Verify a FulfillmentEvent was created with Result=NotFound
8. Verify Order.Status remains Open (unchanged)

## Expected Results
- Response: `{ success: true, data: { result: "NotFound", ... } }`
- Inventory.OnHandQty = 10 (unchanged)
- OrderLine.QtyFulfilled = 0 (unchanged)
- FulfillmentEvent created with Result=NotFound
- Order.Status = Open (unchanged)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP02_ScanBarcode_NotFound"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, no inventory or fulfillment state changes occurred
- **Fail:** Any assertion fails, or inventory/fulfillment state was modified
