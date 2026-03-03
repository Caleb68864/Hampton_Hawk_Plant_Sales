---
scenario_id: "SR-02"
title: "Scan Blocked When Sale Is Closed"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-02: Scan Blocked When Sale Is Closed

## Description
Verifies that scanning any barcode is blocked with result=SaleClosedBlocked when the sale has been administratively closed, and that no inventory or fulfillment state changes occur.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR02"}' \
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
     -d '{"name":"Test Customer SR02","email":"sr02@test.com"}' \
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

5. Close the sale using the admin PIN:
   ```bash
   curl -s -X PUT http://localhost:8080/api/settings/sale-closed \
     -H "Content-Type: application/json" \
     -H "X-Admin-Pin: 1234" \
     -H "X-Admin-Reason: SR02 test close" \
     -d '{"isClosed":true}' \
     | jq .
   # Verify: success=true
   ```

6. Attempt to scan barcode BC001 against the order:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Capture: data.result
   ```

7. Check inventory to confirm no change:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should still be 10)
   ```

8. Check order fulfillment to confirm no change:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Confirm: qtyFulfilled=0 on the line
   ```

9. Reopen the sale (cleanup):
   ```bash
   curl -s -X PUT http://localhost:8080/api/settings/sale-closed \
     -H "Content-Type: application/json" \
     -H "X-Admin-Pin: 1234" \
     -H "X-Admin-Reason: SR02 test reopen" \
     -d '{"isClosed":false}' \
     | jq .
   # Verify: success=true
   ```

## Expected Results
- Step 5 response: HTTP 200, `success=true` (sale closed successfully)
- Step 6 response: `data.result="SaleClosedBlocked"`
- Step 7 response: `data.quantity=10` (no inventory change)
- Step 8 response: order line `qtyFulfilled=0` (no fulfillment change)
- Step 9 response: HTTP 200, `success=true` (sale reopened)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Scan while sale is closed returns result=SaleClosedBlocked, inventory remains at 10, order line qtyFulfilled stays at 0, and the sale is successfully reopened in cleanup.
- **Fail:** Scan is accepted while sale is closed, inventory decrements, qtyFulfilled changes, or the sale cannot be closed/reopened via admin PIN.
