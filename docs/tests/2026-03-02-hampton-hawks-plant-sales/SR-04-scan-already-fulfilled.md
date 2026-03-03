---
scenario_id: "SR-04"
title: "Scan Already Fulfilled"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-04: Scan Already Fulfilled

## Description
Verifies that scanning a barcode a second time after the order line is fully fulfilled returns result=AlreadyFulfilled and does not further decrement inventory.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR04"}' \
     | jq .
   # Capture: data.id -> PLANT_ID
   ```

2. Set inventory quantity to 10:
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
     -d '{"name":"Test Customer SR04","email":"sr04@test.com"}' \
     | jq .
   # Capture: data.id -> CUSTOMER_ID
   ```

4. Create an order with one line (qtyOrdered=1):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders \
     -H "Content-Type: application/json" \
     -d "{\"customerId\":${CUSTOMER_ID},\"lines\":[{\"plantCatalogId\":${PLANT_ID},\"qtyOrdered\":1}]}" \
     | jq .
   # Capture: data.id -> ORDER_ID
   ```

5. Perform the first scan (should be Accepted):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Verify: data.result="Accepted", data.qtyFulfilled=1
   ```

6. Confirm inventory after first scan:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should be 9)
   ```

7. Perform the second scan against the already-fulfilled line:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Capture: data.result
   ```

8. Confirm inventory did not change on second scan:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should still be 9)
   ```

## Expected Results
- Step 5 response: `data.result="Accepted"`, `data.qtyFulfilled=1`
- Step 6 response: `data.quantity=9`
- Step 7 response: `data.result="AlreadyFulfilled"`
- Step 8 response: `data.quantity=9` (no further decrement)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** First scan returns Accepted with qtyFulfilled=1 and inventory at 9; second scan returns AlreadyFulfilled and inventory remains at 9.
- **Fail:** Second scan returns Accepted, inventory drops below 9, or qtyFulfilled exceeds the qtyOrdered of 1.
