---
scenario_id: "SR-03"
title: "Scan Wrong Order Hard Block"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-03: Scan Wrong Order Hard Block

## Description
Verifies that scanning a barcode belonging to a plant not present on the target order returns result=WrongOrder and records a FulfillmentEvent with that result.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create plant A (barcode=BCA):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P-A","barcode":"BCA","name":"Plant A SR03"}' \
     | jq .
   # Capture: data.id -> PLANT_A_ID
   ```

2. Create plant B (barcode=BCB):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P-B","barcode":"BCB","name":"Plant B SR03"}' \
     | jq .
   # Capture: data.id -> PLANT_B_ID
   ```

3. Set inventory for both plants:
   ```bash
   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_A_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":5}' \
     | jq .

   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_B_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":5}' \
     | jq .
   ```

4. Create a customer:
   ```bash
   curl -s -X POST http://localhost:8080/api/customers \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Customer SR03","email":"sr03@test.com"}' \
     | jq .
   # Capture: data.id -> CUSTOMER_ID
   ```

5. Create an order with a line for plant A only (qtyOrdered=1):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders \
     -H "Content-Type: application/json" \
     -d "{\"customerId\":${CUSTOMER_ID},\"lines\":[{\"plantCatalogId\":${PLANT_A_ID},\"qtyOrdered\":1}]}" \
     | jq .
   # Capture: data.id -> ORDER_ID
   ```

6. Scan barcode BCB (plant B) against the order that only contains plant A:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BCB"}' \
     | jq .
   # Capture: data.result
   ```

7. Retrieve fulfillment events for the order:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID}/fulfillment-events \
     | jq .
   # Capture: most recent event's result field
   ```

8. Confirm plant B inventory did not change:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_B_ID} \
     | jq .
   # Capture: data.quantity (should still be 5)
   ```

## Expected Results
- Step 6 response: `data.result="WrongOrder"`
- Step 7 response: at least one FulfillmentEvent with `result="WrongOrder"` for this order
- Step 8 response: `data.quantity=5` (plant B inventory unchanged)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Scanning a barcode not associated with any line on the order returns result=WrongOrder, a FulfillmentEvent with Result=WrongOrder is recorded, and no inventory changes occur.
- **Fail:** Scan returns any result other than WrongOrder, no FulfillmentEvent is created, or inventory is modified.
