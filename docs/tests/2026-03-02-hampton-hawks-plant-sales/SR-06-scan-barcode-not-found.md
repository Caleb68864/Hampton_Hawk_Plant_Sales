---
scenario_id: "SR-06"
title: "Scan Barcode Not Found"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-06: Scan Barcode Not Found

## Description
Verifies that scanning a barcode that does not exist in the plant catalog returns result=NotFound and records a FulfillmentEvent with that result.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a customer:
   ```bash
   curl -s -X POST http://localhost:8080/api/customers \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Customer SR06","email":"sr06@test.com"}' \
     | jq .
   # Capture: data.id -> CUSTOMER_ID
   ```

2. Create a plant so the order can be built with a valid line:
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Real Plant SR06"}' \
     | jq .
   # Capture: data.id -> PLANT_ID
   ```

3. Set inventory to 5 for the real plant:
   ```bash
   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":5}' \
     | jq .
   ```

4. Create an order with a line for the real plant (qtyOrdered=1):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders \
     -H "Content-Type: application/json" \
     -d "{\"customerId\":${CUSTOMER_ID},\"lines\":[{\"plantCatalogId\":${PLANT_ID},\"qtyOrdered\":1}]}" \
     | jq .
   # Capture: data.id -> ORDER_ID
   ```

5. Attempt to scan a barcode that does not exist in the catalog:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"NONEXISTENT"}' \
     | jq .
   # Capture: data.result
   ```

6. Retrieve fulfillment events for the order:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID}/fulfillment-events \
     | jq .
   # Capture: most recent event's result field
   ```

7. Confirm inventory for the real plant is unchanged:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should still be 5)
   ```

## Expected Results
- Step 5 response: `data.result="NotFound"`
- Step 6 response: at least one FulfillmentEvent with `result="NotFound"` for this order
- Step 7 response: `data.quantity=5` (no change to real plant inventory)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Scanning an unknown barcode returns result=NotFound, a FulfillmentEvent with Result=NotFound is created, and no inventory or fulfillment state changes.
- **Fail:** Scan returns any other result, no FulfillmentEvent is recorded, or any inventory is modified.
