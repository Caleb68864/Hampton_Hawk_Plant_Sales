---
scenario_id: "EP-07"
title: "Import Inventory via CSV"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-07: Import Inventory via CSV

## Description
Verifies that a CSV file of inventory quantities can be uploaded via `/api/import/inventory`, that unknown SKUs are recorded as `ImportIssue` entries rather than failing the whole import, and that existing inventory quantities are overwritten by subsequent imports.

## Preconditions
- API is running at `http://localhost:8080`
- At least one plant with SKU `FLOWER-SUN-1` exists (created via EP-06 or a prior test step below)
- A local CSV file can be written to a temp location for upload

## Steps
1. POST `/api/plants` with `{"name":"Sunflower","sku":"FLOWER-SUN-1","barcode":"BC-SUN-001","price":3.99,"isActive":true}` if the plant does not already exist. Store the plant `id` as `$PLANT_ID`.
2. Write a CSV file at `/tmp/test-inventory.csv` with header `Sku,OnHandQty` and the following rows:
   - `FLOWER-SUN-1,25` (known SKU)
   - `UNKNOWN-SKU-999,10` (unknown SKU, should become ImportIssue)
3. POST `/api/import/inventory` as `multipart/form-data` with the CSV file and verify response status 200, `success` is `true`, `data.importedCount` is `1`, and `data.skippedCount` is `1`.
4. GET `/api/inventory` and verify the entry for `FLOWER-SUN-1` shows `onHandQty` of `25`.
5. GET `/api/import/batches` and note the most recent Inventory batch `id` as `$BATCH_ID`.
6. GET `/api/import/batches/$BATCH_ID/issues` and verify response status 200, `success` is `true`, and `data` contains one issue with `sku` of `UNKNOWN-SKU-999` and an `issueType` indicating unknown SKU.
7. Write a second CSV file at `/tmp/test-inventory-update.csv` with a single row: `FLOWER-SUN-1,40` to test overwrite behavior.
8. POST `/api/import/inventory` with the second file and verify response status 200, `success` is `true`, `data.importedCount` is `1`.
9. GET `/api/inventory` and verify the entry for `FLOWER-SUN-1` now shows `onHandQty` of `40` (overwritten from `25`).

```bash
BASE="http://localhost:8080"

# Step 1 -- ensure plant exists
PLANT_BODY=$(curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunflower","sku":"FLOWER-SUN-1","barcode":"BC-SUN-001","price":3.99,"isActive":true}')
echo "Plant create/existing response:"
echo "$PLANT_BODY" | python3 -m json.tool

# Step 2 -- write inventory CSV
cat > /tmp/test-inventory.csv << 'EOF'
Sku,OnHandQty
FLOWER-SUN-1,25
UNKNOWN-SKU-999,10
EOF
echo "Inventory CSV written:"
cat /tmp/test-inventory.csv

# Step 3 -- import inventory CSV
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/import/inventory" \
  -F "file=@/tmp/test-inventory.csv;type=text/csv")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Import inventory -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 4 -- verify inventory quantity
curl -s "$BASE/api/inventory" | python3 -m json.tool

# Step 5 -- get batch id
BATCHES=$(curl -s "$BASE/api/import/batches")
BATCH_ID=$(echo "$BATCHES" | python3 -c "
import sys,json
batches = json.load(sys.stdin)['data']
inv_batches = [b for b in batches if b.get('type') == 'Inventory']
print(inv_batches[0]['id'])
")
echo "Inventory Batch ID: $BATCH_ID"

# Step 6 -- get import issues
curl -s "$BASE/api/import/batches/$BATCH_ID/issues" | python3 -m json.tool

# Step 7 -- write second inventory CSV for overwrite test
cat > /tmp/test-inventory-update.csv << 'EOF'
Sku,OnHandQty
FLOWER-SUN-1,40
EOF

# Step 8 -- import second file
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/import/inventory" \
  -F "file=@/tmp/test-inventory-update.csv;type=text/csv")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Import inventory overwrite -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 9 -- verify overwritten quantity
curl -s "$BASE/api/inventory" | python3 -m json.tool
```

## Expected Results
- Step 1: Plant exists or is created successfully
- Step 3: HTTP 200, `success: true`, `data.importedCount` is `1`, `data.skippedCount` is `1`
- Step 4: Inventory list shows `FLOWER-SUN-1` with `onHandQty: 25`
- Step 6: HTTP 200, `success: true`, issues list contains one entry for `UNKNOWN-SKU-999` with an `issueType` of `UnknownSku`
- Step 8: HTTP 200, `success: true`, `data.importedCount` is `1`
- Step 9: Inventory list shows `FLOWER-SUN-1` with `onHandQty: 40` (previous value of `25` was overwritten)

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** The import processes valid rows, records `ImportIssue` entries for unknown SKUs without failing the entire import, existing inventory quantities are overwritten (not summed) on re-import, and all response counts match expectations.
- **Fail:** Any step returns an unexpected status code, the unknown SKU causes the entire import to fail instead of being recorded as an issue, `onHandQty` is not overwritten on the second import, or `success` is the wrong boolean value.
