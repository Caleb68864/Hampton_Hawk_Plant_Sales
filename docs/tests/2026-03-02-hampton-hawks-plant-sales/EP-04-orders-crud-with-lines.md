---
scenario_id: "EP-04"
title: "Orders CRUD with Lines"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-04: Orders CRUD with Lines

## Description
Verifies full create, read, and line management lifecycle for orders via the `/api/orders` endpoints. Confirms auto-generated `OrderNumber`, retrieval of an order with its lines, and add/update/remove operations on individual order lines.

## Preconditions
- API is running at `http://localhost:8080`
- A customer, seller, and plant must be created before this scenario runs (steps 1-3 are setup)
- Database has no conflicting records for the setup entities

## Steps
1. POST `/api/plants` with `{"name":"Pepper Plant","sku":"PEP-BELL-4IN","barcode":"BC-PEP-001","price":3.99,"isActive":true}` and store returned `id` as `$PLANT_ID`.
2. POST `/api/customers` with `{"displayName":"Bob Brown","firstName":"Bob","lastName":"Brown","phone":"555-0001","email":"bob@example.com"}` and store returned `id` as `$CUSTOMER_ID`.
3. POST `/api/sellers` with `{"displayName":"Sam Seller","firstName":"Sam","lastName":"Seller","grade":"4","teacher":"Mr. Green"}` and store returned `id` as `$SELLER_ID`.
4. POST `/api/orders` with body `{"customerId":"$CUSTOMER_ID","sellerId":"$SELLER_ID","isWalkUp":false,"lines":[{"plantCatalogId":"$PLANT_ID","qtyOrdered":3}]}` and verify response status 200, `success` is `true`, `data.id` is a non-empty UUID, and `data.orderNumber` is a non-empty string.
5. Store the returned `id` as `$ORDER_ID` and `orderNumber` as `$ORDER_NUMBER`.
6. GET `/api/orders/$ORDER_ID` and verify response status 200, `success` is `true`, `data.orderNumber` equals `$ORDER_NUMBER`, and `data.lines` contains one entry with `plantCatalogId` equal to `$PLANT_ID` and `qtyOrdered` equal to `3`.
7. Store the first line's `id` as `$LINE_ID`.
8. POST `/api/orders/$ORDER_ID/lines` with body `{"plantCatalogId":"$PLANT_ID","qtyOrdered":2}` to add an additional line and verify response status 200 and `success` is `true`.
9. PUT `/api/orders/$ORDER_ID/lines/$LINE_ID` with body `{"qtyOrdered":5}` to update the original line quantity and verify response status 200, `success` is `true`, and the updated qty is reflected.
10. DELETE `/api/orders/$ORDER_ID/lines/$LINE_ID` and verify response status 200 and `success` is `true`.
11. GET `/api/orders/$ORDER_ID` and verify the deleted line is no longer present in `data.lines`.

```bash
BASE="http://localhost:8080"

# Step 1 -- create plant
PLANT_BODY=$(curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pepper Plant","sku":"PEP-BELL-4IN","barcode":"BC-PEP-001","price":3.99,"isActive":true}')
PLANT_ID=$(echo "$PLANT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Plant ID: $PLANT_ID"

# Step 2 -- create customer
CUSTOMER_BODY=$(curl -s -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Bob Brown","firstName":"Bob","lastName":"Brown","phone":"555-0001","email":"bob@example.com"}')
CUSTOMER_ID=$(echo "$CUSTOMER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Customer ID: $CUSTOMER_ID"

# Step 3 -- create seller
SELLER_BODY=$(curl -s -X POST "$BASE/api/sellers" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Sam Seller","firstName":"Sam","lastName":"Seller","grade":"4","teacher":"Mr. Green"}')
SELLER_ID=$(echo "$SELLER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Seller ID: $SELLER_ID"

# Step 4 -- create order with line
ORDER_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'customerId': '$CUSTOMER_ID',
  'sellerId': '$SELLER_ID',
  'isWalkUp': False,
  'lines': [{'plantCatalogId': '$PLANT_ID', 'qtyOrdered': 3}]
}))
")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/orders" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Create order -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

ORDER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
ORDER_NUMBER=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['orderNumber'])")
echo "Order ID: $ORDER_ID"
echo "Order Number: $ORDER_NUMBER"

# Step 6 -- get order with lines
ORDER_DETAIL=$(curl -s "$BASE/api/orders/$ORDER_ID")
echo "$ORDER_DETAIL" | python3 -m json.tool
LINE_ID=$(echo "$ORDER_DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['lines'][0]['id'])")
echo "Line ID: $LINE_ID"

# Step 8 -- add a new line
curl -s -X POST "$BASE/api/orders/$ORDER_ID/lines" \
  -H "Content-Type: application/json" \
  -d "{\"plantCatalogId\":\"$PLANT_ID\",\"qtyOrdered\":2}" \
  | python3 -m json.tool

# Step 9 -- update the original line
curl -s -X PUT "$BASE/api/orders/$ORDER_ID/lines/$LINE_ID" \
  -H "Content-Type: application/json" \
  -d '{"qtyOrdered":5}' \
  | python3 -m json.tool

# Step 10 -- remove the original line
curl -s -X DELETE "$BASE/api/orders/$ORDER_ID/lines/$LINE_ID" | python3 -m json.tool

# Step 11 -- verify line removed
curl -s "$BASE/api/orders/$ORDER_ID" | python3 -m json.tool
```

## Expected Results
- Steps 1-3: HTTP 200, setup entities created successfully with valid UUIDs
- Step 4: HTTP 200, `success: true`, `data.id` is a valid UUID, `data.orderNumber` is a non-empty auto-generated string
- Step 6: HTTP 200, `success: true`, `data.lines` has one entry with `qtyOrdered: 3`
- Step 8: HTTP 200, `success: true`, line added successfully
- Step 9: HTTP 200, `success: true`, `qtyOrdered` updated to `5`
- Step 10: HTTP 200, `success: true`
- Step 11: HTTP 200, the deleted line ID is no longer present in `data.lines`

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All steps return the expected HTTP status codes and response values, the order is created with an auto-generated `orderNumber`, lines can be added/updated/removed, and removed lines no longer appear in the order detail response.
- **Fail:** Any step returns an unexpected status code, `data.orderNumber` is missing or empty, `data.lines` does not reflect changes after add/update/delete operations, or `success` is the wrong boolean value.
