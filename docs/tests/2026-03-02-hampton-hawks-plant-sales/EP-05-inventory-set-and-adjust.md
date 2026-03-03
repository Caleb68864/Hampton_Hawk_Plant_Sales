---
scenario_id: "EP-05"
title: "Inventory Set and Adjust"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-05: Inventory Set and Adjust

## Description
Verifies that inventory can be set directly via PUT and adjusted with a delta via POST, and that the inventory list returns records with associated plant information.

## Preconditions
- API is running at `http://localhost:8080`
- A plant must be created before this scenario runs (step 1 is setup)
- Admin PIN `1234` is configured via the `APP_ADMIN_PIN` environment variable

## Steps
1. POST `/api/plants` with `{"name":"Basil Plant","sku":"HERB-BASIL-2IN","barcode":"BC-BASIL-001","price":2.49,"isActive":true}` and store returned `id` as `$PLANT_ID`.
2. PUT `/api/inventory/$PLANT_ID` with body `{"onHandQty":50,"reason":"Initial stock set"}` and verify response status 200, `success` is `true`, and `data.onHandQty` is `50`.
3. GET `/api/inventory` and verify response status 200, `success` is `true`, and `data` contains at least one entry that includes plant information (e.g., `sku` or `name`) alongside the inventory quantity.
4. Verify the entry for `$PLANT_ID` in the list shows `onHandQty` of `50`.
5. POST `/api/inventory/adjust` with body `{"plantCatalogId":"$PLANT_ID","deltaQty":10,"reason":"Received additional shipment"}` and verify response status 200, `success` is `true`.
6. GET `/api/inventory` and verify the entry for `$PLANT_ID` now shows `onHandQty` of `60`.
7. POST `/api/inventory/adjust` with body `{"plantCatalogId":"$PLANT_ID","deltaQty":-5,"reason":"Damaged items removed"}` and verify response status 200 and `success` is `true`.
8. GET `/api/inventory` and verify the entry for `$PLANT_ID` now shows `onHandQty` of `55`.

```bash
BASE="http://localhost:8080"

# Step 1 -- create plant
PLANT_BODY=$(curl -s -X POST "$BASE/api/plants" \
  -H "Content-Type: application/json" \
  -d '{"name":"Basil Plant","sku":"HERB-BASIL-2IN","barcode":"BC-BASIL-001","price":2.49,"isActive":true}')
PLANT_ID=$(echo "$PLANT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Plant ID: $PLANT_ID"

# Step 2 -- set inventory
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/inventory/$PLANT_ID" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Pin: 1234" \
  -d '{"onHandQty":50,"reason":"Initial stock set"}')
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Set inventory -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 3 -- list inventory
curl -s "$BASE/api/inventory" | python3 -m json.tool

# Step 5 -- positive adjustment
ADJUST_PAYLOAD=$(python3 -c "
import json
print(json.dumps({'plantCatalogId': '$PLANT_ID', 'deltaQty': 10, 'reason': 'Received additional shipment'}))
")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/inventory/adjust" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Pin: 1234" \
  -d "$ADJUST_PAYLOAD")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Positive adjust -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 6 -- verify qty is now 60
curl -s "$BASE/api/inventory" | python3 -m json.tool

# Step 7 -- negative adjustment
NEG_PAYLOAD=$(python3 -c "
import json
print(json.dumps({'plantCatalogId': '$PLANT_ID', 'deltaQty': -5, 'reason': 'Damaged items removed'}))
")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/inventory/adjust" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Pin: 1234" \
  -d "$NEG_PAYLOAD")
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Negative adjust -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

# Step 8 -- verify qty is now 55
curl -s "$BASE/api/inventory" | python3 -m json.tool
```

## Expected Results
- Step 1: HTTP 200, plant created with a valid UUID
- Step 2: HTTP 200, `success: true`, `data.onHandQty` is `50`
- Step 3: HTTP 200, `success: true`, list includes at least one entry with plant info and quantity data
- Step 4: The entry for the created plant shows `onHandQty: 50`
- Step 5: HTTP 200, `success: true`
- Step 6: The entry for the plant shows `onHandQty: 60`
- Step 7: HTTP 200, `success: true`
- Step 8: The entry for the plant shows `onHandQty: 55`

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All steps return the expected HTTP status codes, the initial set lands at `50`, the positive delta brings it to `60`, and the negative delta brings it down to `55`. The inventory list response includes plant-level information alongside quantities.
- **Fail:** Any step returns an unexpected status code, `onHandQty` does not reflect the expected value after any set or adjust operation, `success` is the wrong boolean value, or inventory list entries are missing plant information.
