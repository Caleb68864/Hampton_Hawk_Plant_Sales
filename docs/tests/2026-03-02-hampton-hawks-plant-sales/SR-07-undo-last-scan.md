---
scenario_id: "SR-07"
title: "Undo Last Scan"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-07: Undo Last Scan

## Description
Verifies that undoing the last scan on an order restores inventory by 1 and decrements qtyFulfilled back to its pre-scan value.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR07"}' \
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
     -d '{"name":"Test Customer SR07","email":"sr07@test.com"}' \
     | jq .
   # Capture: data.id -> CUSTOMER_ID
   ```

4. Create an order with one line (qtyOrdered=3):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders \
     -H "Content-Type: application/json" \
     -d "{\"customerId\":${CUSTOMER_ID},\"lines\":[{\"plantCatalogId\":${PLANT_ID},\"qtyOrdered\":3}]}" \
     | jq .
   # Capture: data.id -> ORDER_ID
   ```

5. Scan barcode BC001 (first scan, should be Accepted):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Verify: data.result="Accepted"
   ```

6. Confirm state after scan: inventory=9, qtyFulfilled=1:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} | jq .
   curl -s http://localhost:8080/api/orders/${ORDER_ID} | jq .
   ```

7. Undo the last scan on the order:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/undo-last-scan \
     | jq .
   # Verify: success=true
   ```

8. Confirm inventory is restored to 10:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should be 10)
   ```

9. Confirm qtyFulfilled is back to 0:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Confirm: line qtyFulfilled=0
   ```

## Expected Results
- Step 5 response: `data.result="Accepted"`
- Step 6: inventory=9, line qtyFulfilled=1
- Step 7 response: `success=true`
- Step 8 response: `data.quantity=10` (restored)
- Step 9 response: order line `qtyFulfilled=0` (restored)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** After a successful scan followed by an undo, inventory returns to 10 and qtyFulfilled returns to 0.
- **Fail:** Undo endpoint returns an error, inventory does not increment back to 10, or qtyFulfilled remains at 1 after the undo.
