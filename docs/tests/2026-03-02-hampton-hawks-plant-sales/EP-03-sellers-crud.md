---
scenario_id: "EP-03"
title: "Sellers CRUD"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-03: Sellers CRUD

## Description
Verifies full create, read, update, and soft-delete lifecycle for sellers (student fundraiser participants) via the `/api/sellers` endpoints.

## Preconditions
- API is running at `http://localhost:8080`
- Database is empty or has no conflicting seller records

## Steps
1. POST `/api/sellers` with body `{"displayName":"Alex Johnson","firstName":"Alex","lastName":"Johnson","grade":"5","teacher":"Mrs. Davis"}` and verify response status 200, `success` is `true`, and `data.id` is a non-empty UUID.
2. Store the returned `id` as `$SELLER_ID`.
3. GET `/api/sellers` and verify response status 200, `success` is `true`, and `data` contains at least one item with `displayName` equal to `Alex Johnson`.
4. GET `/api/sellers/$SELLER_ID` and verify response status 200, `success` is `true`, `data.displayName` is `Alex Johnson`, `data.grade` is `5`, and `data.teacher` is `Mrs. Davis`.
5. PUT `/api/sellers/$SELLER_ID` with body `{"displayName":"Alex Johnson","firstName":"Alex","lastName":"Johnson","grade":"6","teacher":"Mr. Lee"}` and verify response status 200, `success` is `true`, `data.grade` is `6`, and `data.teacher` is `Mr. Lee`.
6. DELETE `/api/sellers/$SELLER_ID` and verify response status 200 and `success` is `true`.
7. GET `/api/sellers/$SELLER_ID` and verify response status 404 (soft-deleted record excluded by default).

```bash
BASE="http://localhost:8080"

# Step 1 -- create seller
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/sellers" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Alex Johnson","firstName":"Alex","lastName":"Johnson","grade":"5","teacher":"Mrs. Davis"}')
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Create seller -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

SELLER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Seller ID: $SELLER_ID"

# Step 3 -- list sellers
curl -s "$BASE/api/sellers" | python3 -m json.tool

# Step 4 -- get by id
curl -s "$BASE/api/sellers/$SELLER_ID" | python3 -m json.tool

# Step 5 -- update seller
curl -s -X PUT "$BASE/api/sellers/$SELLER_ID" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Alex Johnson","firstName":"Alex","lastName":"Johnson","grade":"6","teacher":"Mr. Lee"}' \
  | python3 -m json.tool

# Step 6 -- delete seller
curl -s -X DELETE "$BASE/api/sellers/$SELLER_ID" | python3 -m json.tool

# Step 7 -- confirm 404 after soft delete
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/sellers/$SELLER_ID"
echo ""
```

## Expected Results
- Step 1: HTTP 200, `success: true`, `data.id` is a valid UUID
- Step 3: HTTP 200, `success: true`, list contains a seller with `displayName` of `Alex Johnson`
- Step 4: HTTP 200, `success: true`, `data.displayName` is `Alex Johnson`, `data.grade` is `5`, `data.teacher` is `Mrs. Davis`
- Step 5: HTTP 200, `success: true`, `data.grade` is `6`, `data.teacher` is `Mr. Lee`
- Step 6: HTTP 200, `success: true`
- Step 7: HTTP 404 (soft-deleted seller not returned by default)

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All 7 steps return the expected HTTP status codes and response envelope values described above, and the updated grade and teacher fields reflect the new values after PUT.
- **Fail:** Any step returns an unexpected status code, `success` is the wrong boolean value, updated fields do not reflect changes, or the soft-deleted seller is returned by a default GET request.
