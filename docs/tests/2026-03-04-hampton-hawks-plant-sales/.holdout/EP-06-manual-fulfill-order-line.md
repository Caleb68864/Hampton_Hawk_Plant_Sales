---
scenario_id: "EP-06"
title: "Manual fulfill order line"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-06: Manual fulfill order line

## Description
Verifies that manually fulfilling an OrderLine via the manual-fulfill endpoint decrements inventory, increments QtyFulfilled, and creates a FulfillmentEvent with the provided audit reason.

## Preconditions
- An Order exists with status Open and at least one OrderLine
- The OrderLine has QtyOrdered=3 and QtyFulfilled=0
- Inventory for the OrderLine's PlantCatalog has OnHandQty >= 1

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/manual-fulfill` with body `{ "orderLineId": {orderLineId}, "reason": "Customer brought plant to counter without scanning" }`
3. Assert response status 200 with `success: true`
4. Assert response data contains fulfillment confirmation
5. Verify Inventory.OnHandQty decreased to 9
6. Verify OrderLine.QtyFulfilled increased to 1
7. Verify a FulfillmentEvent was created with Result=Accepted and the reason "Customer brought plant to counter without scanning"
8. Verify Order.Status changed to InProgress

## Expected Results
- Response: `{ success: true, data: { ... } }`
- Inventory.OnHandQty = 9
- OrderLine.QtyFulfilled = 1
- FulfillmentEvent created with Result=Accepted and Reason="Customer brought plant to counter without scanning"
- Order.Status = InProgress

## Execution Tool
bash -- `cd api && dotnet test --filter "EP06_ManualFulfill_OrderLine"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, inventory decremented, fulfillment incremented, event includes audit reason
- **Fail:** Any assertion fails, or audit reason is missing from the FulfillmentEvent
