---
scenario_id: "EP-01"
title: "Plants CRUD"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-01: Plants CRUD

## Description
Verifies full create, read, update, and soft-delete lifecycle for plant catalog entries via the `/api/plants` endpoints. Also confirms that duplicate SKU and duplicate Barcode submissions are rejected with a 400 error.

## Preconditions
- API is running at `http://localhost:8080`
- Database is empty or has no conflicting SKU/Barcode values

## Steps
1. POST `/api/plants` with body `{"name":"Cherry Tomato","sku":"TOM-CHERRY-4IN","barcode":"BC-TOM-001","price":4.99,"isActive":true}` and verify response status 200, `success` is `true`, and `data.id` is a non-empty UUID.
2. Store the returned `id` as `$PLANT_ID`.
3. GET `/api/plants` and verify response status 200, `success` is `true`, and `data` contains at least one item with `sku` equal to `TOM-CHERRY-4IN`.
4. GET `/api/plants/$PLANT_ID` and verify response status 200, `success` is `true`, `data.sku` is `TOM-CHERRY-4IN`, and `data.name` is `Cherry Tomato`.
5. PUT `/api/plants/$PLANT_ID` with body `{"name":"Cherry Tomato Updated","sku":"TOM-CHERRY-4IN","barcode":"BC-TOM-001","price":5.49,"isActive":true}` and verify response status 200, `success` is `true`, and `data.name` is `Cherry Tomato Updated`.
6. DELETE `/api/plants/$PLANT_ID` and verify response status 200 and `success` is `true`.
7. GET `/api/plants/$PLANT_ID` and verify response status 404 (soft-deleted record excluded by default).
8. POST `/api/plants` again with the same `sku` value `TOM-CHERRY-4IN` (different barcode) and verify response status 400 and `success` is `false`.
9. POST `/api/plants` with a new unique SKU but the same `barcode` value `BC-TOM-001` and verify response status 400 and `success` is `false`.

```bash
BASE="http://localhost:8080"

# Step 1 -- create plant
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cherry Tomato","sku":"TOM-CHERRY-4IN","barcode":"BC-TOM-001","price":4.99,"isActive":true}')
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Create plant -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

PLANT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Plant ID: $PLANT_ID"

# Step 3 -- list plants
curl -s "$BASE/api/plants" | python3 -m json.tool

# Step 4 -- get by id
curl -s "$BASE/api/plants/$PLANT_ID" | python3 -m json.tool

# Step 5 -- update plant
curl -s -X PUT "$BASE/api/plants/$PLANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cherry Tomato Updated","sku":"TOM-CHERRY-4IN","barcode":"BC-TOM-001","price":5.49,"isActive":true}' \
  | python3 -m json.tool

# Step 6 -- delete plant
curl -s -X DELETE "$BASE/api/plants/$PLANT_ID" | python3 -m json.tool

# Step 7 -- confirm 404 after soft delete
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/plants/$PLANT_ID"
echo ""

# Step 8 -- duplicate SKU
curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Another Tomato","sku":"TOM-CHERRY-4IN","barcode":"BC-TOM-999","price":3.99,"isActive":true}' \
  | python3 -m json.tool

# Step 9 -- duplicate Barcode
curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Brand New Plant","sku":"NEW-PLANT-001","barcode":"BC-TOM-001","price":2.99,"isActive":true}' \
  | python3 -m json.tool
```

## Expected Results
- Step 1: HTTP 200, `success: true`, `data.id` is a valid UUID
- Step 3: HTTP 200, `success: true`, list contains the created plant
- Step 4: HTTP 200, `success: true`, `data.sku` is `TOM-CHERRY-4IN`
- Step 5: HTTP 200, `success: true`, `data.name` is `Cherry Tomato Updated`
- Step 6: HTTP 200, `success: true`
- Step 7: HTTP 404 (soft-deleted plant not returned)
- Step 8: HTTP 400, `success: false`, errors mention duplicate SKU
- Step 9: HTTP 400, `success: false`, errors mention duplicate Barcode

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All 9 steps return the expected HTTP status codes and response envelope values described above, with no unexpected errors.
- **Fail:** Any step returns an unexpected status code, `success` is the wrong boolean value, `data.id` is missing on create, or duplicate SKU/Barcode requests are not rejected with 400.
