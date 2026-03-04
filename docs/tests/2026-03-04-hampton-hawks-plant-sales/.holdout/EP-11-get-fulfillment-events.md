---
scenario_id: "EP-11"
title: "Get fulfillment events"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-11: Get fulfillment events

## Description
Verifies that after performing several scan operations on an order, calling the events endpoint returns the full list of FulfillmentEvents in chronological order.

## Preconditions
- An Order exists with status Open and at least one OrderLine
- The OrderLine's PlantCatalog has a known barcode
- Inventory for that PlantCatalog has OnHandQty >= 3

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=5, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }` -- first scan (Accepted)
3. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }` -- second scan (Accepted)
4. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "NONEXISTENT-999" }` -- third scan (NotFound)
5. Call `GET /api/orders/{orderId}/events`
6. Assert response status 200 with `success: true`
7. Assert response data contains a list of 3 FulfillmentEvents
8. Verify events are in chronological order (earliest CreatedAt first)
9. Verify first event has Result=Accepted and barcode "TEST-001"
10. Verify second event has Result=Accepted and barcode "TEST-001"
11. Verify third event has Result=NotFound and barcode "NONEXISTENT-999"
12. Verify each event includes orderId, timestamp, and result fields

## Expected Results
- Response: `{ success: true, data: [ { result: "Accepted", barcode: "TEST-001", ... }, { result: "Accepted", barcode: "TEST-001", ... }, { result: "NotFound", barcode: "NONEXISTENT-999", ... } ] }`
- 3 FulfillmentEvents returned
- Events sorted chronologically (ascending by CreatedAt)
- Each event contains orderId, barcode, result, and timestamp

## Execution Tool
bash -- `cd api && dotnet test --filter "EP11_GetFulfillmentEvents"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, correct number of events returned in chronological order with expected results
- **Fail:** Any assertion fails, or events missing, out of order, or contain incorrect data
