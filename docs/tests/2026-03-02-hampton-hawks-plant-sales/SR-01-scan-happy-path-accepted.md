---
scenario_id: "SR-01"
title: "Scan Happy Path - Accepted"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-01: Scan Happy Path - Accepted

## Description
Verifies that scanning a valid barcode against a matching order line decrements inventory and records a FulfillmentEvent with Result=Accepted.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant 01"}' \
     | jq .
   # Capture: data.id -> PLANT_ID
   ```

2. Set inventory quantity to 10 for the plant:
   ```bash
   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":10}' \
     | jq .
   ```

3. Create a customer:
   ```bash
   curl -s -X POST http://localhost:8080/api/customers \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Customer SR01","email":"sr01@test.com"}' \
     | jq .
   # Capture: data.id -> CUSTOMER_ID
   ```

4. Create an order with one line (plantCatalogId=PLANT_ID, qtyOrdered=3):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders \
     -H "Content-Type: application/json" \
     -d "{\"customerId\":${CUSTOMER_ID},\"lines\":[{\"plantCatalogId\":${PLANT_ID},\"qtyOrdered\":3}]}" \
     | jq .
   # Capture: data.id -> ORDER_ID
   ```

5. Scan barcode BC001 against the order:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Capture: data.result, data.qtyFulfilled
   ```

6. Check current inventory for the plant:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity
   ```

7. Retrieve the fulfillment events for the order:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID}/fulfillment-events \
     | jq .
   # Capture: most recent event's result field
   ```

## Expected Results
- Step 5 response: HTTP 200, `success=true`, `data.result="Accepted"`
- Step 5 response: `data.qtyFulfilled=1`
- Step 6 response: `data.quantity=9` (decremented from 10)
- Step 7 response: at least one FulfillmentEvent with `result="Accepted"`

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Scan returns HTTP 200 with result=Accepted, qtyFulfilled increments to 1, inventory decrements from 10 to 9, and a FulfillmentEvent with Result=Accepted exists for the order.
- **Fail:** Any non-200 response on scan, result is not Accepted, inventory does not decrement, qtyFulfilled is not 1, or no FulfillmentEvent is recorded.
