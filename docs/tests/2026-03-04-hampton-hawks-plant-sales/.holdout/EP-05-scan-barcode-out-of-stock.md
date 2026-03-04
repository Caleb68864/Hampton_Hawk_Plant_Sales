---
scenario_id: "EP-05"
title: "Scan barcode - out of stock"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-05: Scan barcode - out of stock

## Description
Verifies that scanning a barcode when Inventory.OnHandQty is 0 returns an "OutOfStock" result and makes no changes to inventory or fulfillment state.

## Preconditions
- An Order exists with status Open and at least one OrderLine
- The OrderLine's PlantCatalog has a known barcode "TEST-001"
- Inventory for that PlantCatalog has OnHandQty=0

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=0, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains `result: "OutOfStock"`
5. Verify Inventory.OnHandQty remains 0 (unchanged)
6. Verify OrderLine.QtyFulfilled remains 0 (unchanged)
7. Verify a FulfillmentEvent was created with Result=OutOfStock
8. Verify Order.Status remains Open (unchanged)

## Expected Results
- Response: `{ success: true, data: { result: "OutOfStock", ... } }`
- Inventory.OnHandQty = 0 (unchanged)
- OrderLine.QtyFulfilled = 0 (unchanged)
- FulfillmentEvent created with Result=OutOfStock
- Order.Status = Open (unchanged)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP05_ScanBarcode_OutOfStock"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, no inventory or fulfillment state changes occurred
- **Fail:** Any assertion fails, or inventory went negative, or fulfillment state was modified
