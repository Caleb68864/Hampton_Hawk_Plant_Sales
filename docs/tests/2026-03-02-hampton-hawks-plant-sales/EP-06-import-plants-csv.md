---
scenario_id: "EP-06"
title: "Import Plants via CSV"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-06: Import Plants via CSV

## Description
Verifies that a CSV file of plant records can be uploaded via multipart form POST to `/api/import/plants`, and that the response reports correct `importedCount` and `skippedCount` values. Also confirms that the import batch is visible in the `/api/import/batches` list.

## Preconditions
- API is running at `http://localhost:8080`
- No existing plants in the database that would conflict with the CSV test data SKUs or barcodes
- A local CSV file can be written to a temp location for upload

## Steps
1. Write a CSV file at `/tmp/test-plants.csv` with header `Name,Sku,Barcode,Price,IsActive` and the following rows:
   - `Sunflower,FLOWER-SUN-1,BC-SUN-001,3.99,true`
   - `Marigold,FLOWER-MAR-1,BC-MAR-001,2.99,true`
   - `Lavender,HERB-LAV-1,BC-LAV-001,4.49,true`
   - A duplicate row: `Sunflower Dupe,FLOWER-SUN-1,BC-SUN-DUPE,3.99,true` (duplicate SKU, should be skipped)
2. POST `/api/import/plants` as `multipart/form-data` with the CSV file attached and verify response status 200, `success` is `true`, `data.importedCount` is `3`, and `data.skippedCount` is `1`.
3. GET `/api/import/batches` and verify response status 200, `success` is `true`, and `data` contains at least one batch entry with `type` of `Plants`.
4. Verify the batch entry has `importedCount` of `3` and `skippedCount` of `1`.
5. GET `/api/plants` and verify that `Sunflower`, `Marigold`, and `Lavender` are present and the duplicate row was not imported.

```bash
BASE="http://localhost:8080"

# Step 1 -- write CSV file
cat > /tmp/test-plants.csv << 'EOF'
Name,Sku,Barcode,Price,IsActive
Sunflower,FLOWER-SUN-1,BC-SUN-001,3.99,true
Marigold,FLOWER-MAR-1,BC-MAR-001,2.99,true
Lavender,HERB-LAV-1,BC-LAV-001,4.49,true
Sunflower Dupe,FLOWER-SUN-1,BC-SUN-DUPE,3.99,true
EOF
echo "CSV written to /tmp/test-plants.csv"
cat /tmp/test-plants.csv

# Step 2 -- import plants CSV
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/import/plants" \
  -F "file=@/tmp/test-plants.csv;type=text/csv")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Import plants -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 3 -- list import batches
BATCHES=$(curl -s "$BASE/api/import/batches")
echo "Import batches:"
echo "$BATCHES" | python3 -m json.tool

# Step 5 -- verify plants exist
curl -s "$BASE/api/plants" | python3 -m json.tool
```

## Expected Results
- Step 1: CSV file created at `/tmp/test-plants.csv` with 4 data rows (1 duplicate SKU)
- Step 2: HTTP 200, `success: true`, `data.importedCount` is `3`, `data.skippedCount` is `1`
- Step 3: HTTP 200, `success: true`, at least one batch of `type: "Plants"` present in list
- Step 4: The most recent Plants batch shows `importedCount: 3` and `skippedCount: 1`
- Step 5: HTTP 200, plant list contains `Sunflower`, `Marigold`, and `Lavender`; the duplicate `Sunflower Dupe` row was not imported as a separate record

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All steps succeed, the import returns the correct counts, the batch record appears in the batches list with matching counts, and only the 3 valid unique plants appear in the catalog.
- **Fail:** Any step returns an unexpected status code, `importedCount` or `skippedCount` do not match expected values, no batch record is created, `success` is the wrong boolean value, or the duplicate plant SKU is imported instead of skipped.
