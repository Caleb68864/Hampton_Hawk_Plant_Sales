---
scenario_id: "SR-09"
title: "Complete Order - All Lines Fulfilled"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-09: Complete Order - All Lines Fulfilled

## Description
Verifies that an order whose lines are all fully fulfilled can be marked as Complete via the standard complete endpoint, resulting in status=Complete.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR09"}' \
     | jq .
   # Capture: data.id -> PLANT_ID
   ```

2. Set inventory quantity to 5:
   ```bash
   curl -s -X PUT http://localhost:8080/api/inventory/${PLANT_ID} \
     -H "Content-Type: application/json" \
     -d '{"quantity":5}' \
     | jq .
   ```

3. Create a customer:
   ```bash
   curl -s -X POST http://localhost:8080/api/customers \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Customer SR09","email":"sr09@test.com"}' \
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

5. Scan barcode BC001 to fulfill the single line:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Verify: data.result="Accepted", qtyFulfilled=1 (equals qtyOrdered)
   ```

6. Mark the order as complete:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/complete \
     | jq .
   # Capture: success, data.status
   ```

7. Retrieve the order to confirm its status:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Capture: data.status (should be "Complete")
   ```

## Expected Results
- Step 5 response: `data.result="Accepted"`, `data.qtyFulfilled=1`
- Step 6 response: `success=true`, `data.status="Complete"`
- Step 7 response: `data.status="Complete"`

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** After fulfilling all lines and calling complete, the order transitions to status=Complete as confirmed by both the complete endpoint response and a subsequent GET on the order.
- **Fail:** The complete endpoint returns an error, returns success=false, or the order status is not Complete after the call.
