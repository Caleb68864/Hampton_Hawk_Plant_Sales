---
scenario_id: "EP-08"
title: "Import Orders via CSV"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-08: Import Orders via CSV

## Description
Verifies that a CSV file of order line rows can be uploaded via `/api/import/orders`, that rows sharing the same `OrderNumber` are grouped into a single order with multiple lines, and that rows referencing an unknown SKU are recorded as `ImportIssue` entries while the rest of the order still imports successfully.

## Preconditions
- API is running at `http://localhost:8080`
- At least two known plant SKUs must exist before this test (created in steps 1-2 below)
- A local CSV file can be written to a temp location for upload

## Steps
1. POST `/api/plants` with `{"name":"Tomato","sku":"TOM-ROMA-4IN","barcode":"BC-TOM-ROMA","price":3.49,"isActive":true}` to ensure the SKU exists.
2. POST `/api/plants` with `{"name":"Zucchini","sku":"VEG-ZUCCHINI-4IN","barcode":"BC-ZUC-001","price":4.99,"isActive":true}` to ensure a second SKU exists.
3. Write a CSV file at `/tmp/test-orders.csv` with header `OrderNumber,CustomerDisplayName,SellerDisplayName,Sku,QtyOrdered` and the following rows:
   - `ORD-TEST-001,Alice Walker,Sam Seller,TOM-ROMA-4IN,2` (valid line 1 of order 1)
   - `ORD-TEST-001,Alice Walker,Sam Seller,VEG-ZUCCHINI-4IN,1` (valid line 2 of order 1, same order)
   - `ORD-TEST-002,Carlos Rivera,Sam Seller,TOM-ROMA-4IN,3` (valid line for order 2)
   - `ORD-TEST-002,Carlos Rivera,Sam Seller,UNKNOWN-SKU-999,1` (unknown SKU, should become ImportIssue; order 2 still created)
4. POST `/api/import/orders` as `multipart/form-data` with the CSV file and verify response status 200, `success` is `true`, `data.importedCount` reflects the number of successfully imported order line rows (3), and `data.skippedCount` is `1`.
5. GET `/api/orders` and verify that two orders exist corresponding to `ORD-TEST-001` and `ORD-TEST-002`.
6. Find the order with `orderNumber` of `ORD-TEST-001` and verify it has two lines: one for `TOM-ROMA-4IN` with `qtyOrdered: 2` and one for `VEG-ZUCCHINI-4IN` with `qtyOrdered: 1`.
7. Find the order with `orderNumber` of `ORD-TEST-002` and verify it has one valid line for `TOM-ROMA-4IN` with `qtyOrdered: 3` (the unknown SKU line was skipped but the order was still created).
8. GET `/api/import/batches` and note the most recent Orders batch `id` as `$BATCH_ID`.
9. GET `/api/import/batches/$BATCH_ID/issues` and verify response status 200, `success` is `true`, and `data` contains one issue for `UNKNOWN-SKU-999` with an `issueType` of `UnknownSku`.

```bash
BASE="http://localhost:8080"

# Steps 1-2 -- ensure plants exist
curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tomato","sku":"TOM-ROMA-4IN","barcode":"BC-TOM-ROMA","price":3.49,"isActive":true}' \
  | python3 -m json.tool

curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Zucchini","sku":"VEG-ZUCCHINI-4IN","barcode":"BC-ZUC-001","price":4.99,"isActive":true}' \
  | python3 -m json.tool

# Step 3 -- write orders CSV
cat > /tmp/test-orders.csv << 'EOF'
OrderNumber,CustomerDisplayName,SellerDisplayName,Sku,QtyOrdered
ORD-TEST-001,Alice Walker,Sam Seller,TOM-ROMA-4IN,2
ORD-TEST-001,Alice Walker,Sam Seller,VEG-ZUCCHINI-4IN,1
ORD-TEST-002,Carlos Rivera,Sam Seller,TOM-ROMA-4IN,3
ORD-TEST-002,Carlos Rivera,Sam Seller,UNKNOWN-SKU-999,1
EOF
echo "Orders CSV written:"
cat /tmp/test-orders.csv

# Step 4 -- import orders CSV
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/import/orders" \
  -F "file=@/tmp/test-orders.csv;type=text/csv")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Import orders -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 5 -- list orders
ORDERS=$(curl -s "$BASE/api/orders")
echo "Orders list:"
echo "$ORDERS" | python3 -m json.tool

# Steps 6-7 -- find specific orders and inspect lines
ORDER_001_ID=$(echo "$ORDERS" | python3 -c "
import sys,json
orders = json.load(sys.stdin)['data']
match = [o for o in orders if o.get('orderNumber') == 'ORD-TEST-001']
print(match[0]['id'] if match else 'NOT FOUND')
")
ORDER_002_ID=$(echo "$ORDERS" | python3 -c "
import sys,json
orders = json.load(sys.stdin)['data']
match = [o for o in orders if o.get('orderNumber') == 'ORD-TEST-002']
print(match[0]['id'] if match else 'NOT FOUND')
")

echo "ORD-TEST-001 ID: $ORDER_001_ID"
echo "ORD-TEST-002 ID: $ORDER_002_ID"

echo "--- Order 001 detail ---"
curl -s "$BASE/api/orders/$ORDER_001_ID" | python3 -m json.tool

echo "--- Order 002 detail ---"
curl -s "$BASE/api/orders/$ORDER_002_ID" | python3 -m json.tool

# Steps 8-9 -- get import issues
BATCHES=$(curl -s "$BASE/api/import/batches")
BATCH_ID=$(echo "$BATCHES" | python3 -c "
import sys,json
batches = json.load(sys.stdin)['data']
ord_batches = [b for b in batches if b.get('type') == 'Orders']
print(ord_batches[0]['id'])
")
echo "Orders Batch ID: $BATCH_ID"

curl -s "$BASE/api/import/batches/$BATCH_ID/issues" | python3 -m json.tool
```

## Expected Results
- Steps 1-2: Plants created or already exist with SKUs `TOM-ROMA-4IN` and `VEG-ZUCCHINI-4IN`
- Step 4: HTTP 200, `success: true`, `data.importedCount` is `3`, `data.skippedCount` is `1`
- Step 5: HTTP 200, orders list contains entries for `ORD-TEST-001` and `ORD-TEST-002`
- Step 6: Order `ORD-TEST-001` has exactly 2 lines with the correct plant SKUs and quantities
- Step 7: Order `ORD-TEST-002` has exactly 1 valid line for `TOM-ROMA-4IN`; the unknown SKU line was skipped but the order itself was still created
- Step 9: HTTP 200, `success: true`, issues list contains one entry for `UNKNOWN-SKU-999` with `issueType: "UnknownSku"`

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** The CSV rows are correctly grouped into two orders by `OrderNumber`, `ORD-TEST-001` has two lines, `ORD-TEST-002` has one valid line with the unknown SKU row recorded as an `ImportIssue` rather than causing the order to be dropped, and all counts match.
- **Fail:** Any step returns an unexpected status code, the two CSV rows for `ORD-TEST-001` are not grouped into a single order, `ORD-TEST-002` is dropped entirely because of the unknown SKU row, the unknown SKU is not recorded in the issues list, or `success` is the wrong boolean value.
