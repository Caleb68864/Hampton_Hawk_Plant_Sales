---
scenario_id: "EP-03"
title: "Scan barcode - wrong order"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-03: Scan barcode - wrong order

## Description
Verifies that scanning a valid barcode for a plant that exists in the PlantCatalog but is not on the current order returns a "WrongOrder" result and makes no changes to inventory or fulfillment state.

## Preconditions
- An Order exists with status Open and at least one OrderLine for PlantCatalog "A"
- A separate PlantCatalog "B" exists with barcode "OTHER-PLANT-002" but is not referenced by any OrderLine on this order
- Inventory for PlantCatalog "B" has OnHandQty >= 1

## Steps

1. Create test data: PlantCatalog "A" with barcode "TEST-001" and PlantCatalog "B" with barcode "OTHER-PLANT-002", Inventory for both with OnHandQty=10, Customer, Order with one OrderLine referencing PlantCatalog "A" (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "OTHER-PLANT-002" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains `result: "WrongOrder"`
5. Verify Inventory for PlantCatalog "A" OnHandQty remains 10 (unchanged)
6. Verify Inventory for PlantCatalog "B" OnHandQty remains 10 (unchanged)
7. Verify OrderLine.QtyFulfilled remains 0 (unchanged)
8. Verify a FulfillmentEvent was created with Result=WrongOrder
9. Verify Order.Status remains Open (unchanged)

## Expected Results
- Response: `{ success: true, data: { result: "WrongOrder", ... } }`
- Inventory.OnHandQty for both plants = 10 (unchanged)
- OrderLine.QtyFulfilled = 0 (unchanged)
- FulfillmentEvent created with Result=WrongOrder
- Order.Status = Open (unchanged)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP03_ScanBarcode_WrongOrder"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, no inventory or fulfillment state changes occurred
- **Fail:** Any assertion fails, or inventory/fulfillment state was modified
