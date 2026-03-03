---
scenario_id: "SR-08"
title: "Undo Blocked When Sale Is Closed"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-08: Undo Blocked When Sale Is Closed

## Description
Verifies that the undo-last-scan operation is rejected when the sale has been administratively closed, leaving inventory and fulfillment state unchanged.

## Preconditions
- Docker Compose running
- Empty/fresh database state for this test's entities

## Steps
1. Create a plant catalog entry (sku=P001, barcode=BC001):
   ```bash
   curl -s -X POST http://localhost:8080/api/plants \
     -H "Content-Type: application/json" \
     -d '{"sku":"P001","barcode":"BC001","name":"Test Plant SR08"}' \
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
     -d '{"name":"Test Customer SR08","email":"sr08@test.com"}' \
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

5. Scan once to create a fulfilled event (should be Accepted):
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode":"BC001"}' \
     | jq .
   # Verify: data.result="Accepted", inventory now 9, qtyFulfilled=1
   ```

6. Close the sale using the admin PIN:
   ```bash
   curl -s -X PUT http://localhost:8080/api/settings/sale-closed \
     -H "Content-Type: application/json" \
     -H "X-Admin-Pin: 1234" \
     -H "X-Admin-Reason: SR08 test close" \
     -d '{"isClosed":true}' \
     | jq .
   # Verify: success=true
   ```

7. Attempt to undo the last scan while sale is closed:
   ```bash
   curl -s -X POST http://localhost:8080/api/orders/${ORDER_ID}/undo-last-scan \
     | jq .
   # Capture: success field and any errors
   ```

8. Confirm inventory is unchanged at 9:
   ```bash
   curl -s http://localhost:8080/api/inventory/${PLANT_ID} \
     | jq .
   # Capture: data.quantity (should still be 9)
   ```

9. Confirm qtyFulfilled is still 1:
   ```bash
   curl -s http://localhost:8080/api/orders/${ORDER_ID} \
     | jq .
   # Confirm: line qtyFulfilled=1
   ```

10. Reopen the sale (cleanup):
    ```bash
    curl -s -X PUT http://localhost:8080/api/settings/sale-closed \
      -H "Content-Type: application/json" \
      -H "X-Admin-Pin: 1234" \
      -H "X-Admin-Reason: SR08 test reopen" \
      -d '{"isClosed":false}' \
      | jq .
    # Verify: success=true
    ```

## Expected Results
- Step 5 response: `data.result="Accepted"`, inventory=9, qtyFulfilled=1
- Step 6 response: `success=true` (sale closed)
- Step 7 response: `success=false` or an error indicating the operation is blocked while the sale is closed
- Step 8 response: `data.quantity=9` (no change)
- Step 9 response: order line `qtyFulfilled=1` (no change)
- Step 10 response: `success=true` (sale reopened)

## Execution Tool
bash -- Use curl to call API endpoints at http://localhost:8080

## Pass / Fail Criteria
- **Pass:** Undo-last-scan is rejected when sale is closed, inventory stays at 9, qtyFulfilled stays at 1, and the sale is successfully reopened in cleanup.
- **Fail:** Undo succeeds while sale is closed, inventory increments back to 10, qtyFulfilled drops to 0, or the sale cannot be managed via admin PIN.
