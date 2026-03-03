---
scenario_id: "EP-02"
title: "Customers CRUD"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-02: Customers CRUD

## Description
Verifies full create, read, update, and soft-delete lifecycle for customers via the `/api/customers` endpoints. Also confirms that a `PickupCode` is auto-generated when not provided in the request body.

## Preconditions
- API is running at `http://localhost:8080`
- Database is empty or has no conflicting customer records

## Steps
1. POST `/api/customers` with body `{"displayName":"Jane Smith","firstName":"Jane","lastName":"Smith","phone":"555-1234","email":"jane@example.com"}` (no `pickupCode` field) and verify response status 200, `success` is `true`, `data.id` is a non-empty UUID, and `data.pickupCode` is a non-empty string.
2. Store the returned `id` as `$CUSTOMER_ID` and `pickupCode` as `$PICKUP_CODE`.
3. GET `/api/customers` and verify response status 200, `success` is `true`, and `data` contains at least one item with `displayName` equal to `Jane Smith`.
4. GET `/api/customers/$CUSTOMER_ID` and verify response status 200, `success` is `true`, `data.displayName` is `Jane Smith`, and `data.pickupCode` equals `$PICKUP_CODE`.
5. PUT `/api/customers/$CUSTOMER_ID` with body `{"displayName":"Jane Smith Updated","firstName":"Jane","lastName":"Smith","phone":"555-9999","email":"jane.updated@example.com"}` and verify response status 200, `success` is `true`, and `data.displayName` is `Jane Smith Updated`.
6. DELETE `/api/customers/$CUSTOMER_ID` and verify response status 200 and `success` is `true`.
7. GET `/api/customers/$CUSTOMER_ID` and verify response status 404 (soft-deleted record excluded by default).

```bash
BASE="http://localhost:8080"

# Step 1 -- create customer without pickupCode
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Jane Smith","firstName":"Jane","lastName":"Smith","phone":"555-1234","email":"jane@example.com"}')
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)
echo "Create customer -- HTTP $STATUS"
echo "$BODY" | python3 -m json.tool

CUSTOMER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
PICKUP_CODE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['pickupCode'])")
echo "Customer ID: $CUSTOMER_ID"
echo "Auto-generated PickupCode: $PICKUP_CODE"

# Step 3 -- list customers
curl -s "$BASE/api/customers" | python3 -m json.tool

# Step 4 -- get by id
curl -s "$BASE/api/customers/$CUSTOMER_ID" | python3 -m json.tool

# Step 5 -- update customer
curl -s -X PUT "$BASE/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Jane Smith Updated","firstName":"Jane","lastName":"Smith","phone":"555-9999","email":"jane.updated@example.com"}' \
  | python3 -m json.tool

# Step 6 -- delete customer
curl -s -X DELETE "$BASE/api/customers/$CUSTOMER_ID" | python3 -m json.tool

# Step 7 -- confirm 404 after soft delete
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customers/$CUSTOMER_ID"
echo ""
```

## Expected Results
- Step 1: HTTP 200, `success: true`, `data.id` is a valid UUID, `data.pickupCode` is auto-generated and non-empty
- Step 3: HTTP 200, `success: true`, list contains a customer with `displayName` of `Jane Smith`
- Step 4: HTTP 200, `success: true`, `data.displayName` is `Jane Smith`, `data.pickupCode` matches the auto-generated value
- Step 5: HTTP 200, `success: true`, `data.displayName` is `Jane Smith Updated`
- Step 6: HTTP 200, `success: true`
- Step 7: HTTP 404 (soft-deleted customer not returned by default)

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All 7 steps return the expected HTTP status codes and response envelope values described above, and the auto-generated `PickupCode` is a non-empty unique string present in both the create and fetch responses.
- **Fail:** Any step returns an unexpected status code, `data.pickupCode` is null or empty on create, `success` is the wrong boolean value, or the soft-deleted customer is returned by a default GET request.
