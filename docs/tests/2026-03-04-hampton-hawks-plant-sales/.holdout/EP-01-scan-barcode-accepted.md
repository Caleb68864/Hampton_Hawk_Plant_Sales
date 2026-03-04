---
scenario_id: "EP-01"
title: "Scan barcode - accepted"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-01: Scan barcode - accepted

## Description
Verifies that scanning a valid barcode against an order decrements inventory by 1 and increments the matching OrderLine.QtyFulfilled by 1.

## Preconditions
- An Order exists with status Open and at least one OrderLine
- The OrderLine's PlantCatalog has a known barcode
- Inventory for that PlantCatalog has OnHandQty >= 1

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains `result: "Accepted"`
5. Verify Inventory.OnHandQty decreased to 9
6. Verify OrderLine.QtyFulfilled increased to 1
7. Verify a FulfillmentEvent was created with Result=Accepted
8. Verify Order.Status changed to InProgress

## Expected Results
- Response: `{ success: true, data: { result: "Accepted", ... } }`
- Inventory.OnHandQty = 9
- OrderLine.QtyFulfilled = 1
- FulfillmentEvent created with Result=Accepted
- Order.Status = InProgress

## Execution Tool
bash -- `cd api && dotnet test --filter "EP01_ScanBarcode_Accepted"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, inventory and fulfillment state updated correctly
- **Fail:** Any assertion fails, or inventory/fulfillment state is incorrect
