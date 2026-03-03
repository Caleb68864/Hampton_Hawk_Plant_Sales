---
scenario_id: "SR-10"
title: "Force Complete Order with Admin PIN"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-10: Force Complete Order with Admin PIN

## Description
Verifies that an order with unfulfilled lines can be force-completed by an administrator using the X-Admin-Pin and X-Admin-Reason headers, resulting in status=Complete and a corresponding AdminAction record.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR10"}' \
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
     -d '{"name":"Test Customer SR10","email":"sr10@test.com"}' \
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

5. Scan once to partially fulfill the line (qtyFulfilled=1 out of 3):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Verify: data.result="Accepted", qtyFulfilled=1
   ```

6. Confirm the order is not yet complete (qtyFulfilled=1, qtyOrdered=3):
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Confirm: status is not Complete
   ```

7. Force-complete the order using the admin PIN and reason:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/force-complete \
     -H "Content-Type: application/json" \
     -H "X-Admin-Pin: 1234" \
     -H "X-Admin-Reason: test" \
     | jq .
   # Capture: success, data.status
   ```

8. Retrieve the order to confirm status=Complete:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Capture: data.status (should be "Complete")
   ```

9. Retrieve admin actions to confirm an AdminAction was recorded:
   ```bash
   curl -s http://localhost:8080/api/admin-actions?orderId=${ORDER_ID} \
     -H "X-Admin-Pin: 1234" \
     | jq .
   # Confirm: at least one AdminAction entry referencing ORDER_ID with reason "test"
   ```

## Expected Results
- Step 5 response: `data.result="Accepted"`, `data.qtyFulfilled=1`
- Step 6 response: order status is not Complete, line qtyFulfilled=1 while qtyOrdered=3
- Step 7 response: `success=true`, `data.status="Complete"`
- Step 8 response: `data.status="Complete"`
- Step 9 response: at least one AdminAction record for this order with reason="test"

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Force-complete with valid admin PIN and reason returns success=true, order status becomes Complete despite incomplete fulfillment, and an AdminAction is recorded with the provided reason.
- **Fail:** Force-complete returns an error, is rejected without a valid PIN, order status does not change to Complete, or no AdminAction is created.
