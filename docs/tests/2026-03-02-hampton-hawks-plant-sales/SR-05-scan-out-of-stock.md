---
scenario_id: "SR-05"
title: "Scan Out of Stock"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-05: Scan Out of Stock

## Description
Verifies that scanning a barcode when the plant's inventory quantity is 0 returns result=OutOfStock and does not alter any state.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR05"}' \
     | jq .
   # Capture: data.id -> PLANT_ID
   ```

2. Set inventory quantity to 0:
   ```bash
   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":0}' \
     | jq .
   ```

3. Create a customer:
   ```bash
   curl -s -X POST http://localhost:8080/api/customers \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Customer SR05","email":"sr05@test.com"}' \
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

5. Attempt to scan barcode BC001 against the order:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Capture: data.result
   ```

6. Confirm inventory is still 0 after scan attempt:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should still be 0)
   ```

7. Confirm order line qtyFulfilled is still 0:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Confirm: line qtyFulfilled=0
   ```

## Expected Results
- Step 5 response: `data.result="OutOfStock"`
- Step 6 response: `data.quantity=0` (no change)
- Step 7 response: order line `qtyFulfilled=0` (no change)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Scan against a zero-inventory plant returns result=OutOfStock, inventory stays at 0, and qtyFulfilled remains 0.
- **Fail:** Scan returns Accepted, inventory goes negative, or qtyFulfilled is incremented despite no stock available.
