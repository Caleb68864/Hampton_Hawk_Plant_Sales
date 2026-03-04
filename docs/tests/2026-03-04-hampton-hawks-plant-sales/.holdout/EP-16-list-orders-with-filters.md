---
scenario_id: "EP-16"
title: "List orders with filters and pagination"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - orders
---

# Scenario EP-16: List orders with filters and pagination

## Description
Verifies that `GET /api/orders` correctly applies query filters (`status`, `isWalkUp`, `search`, `sellerId`, `customerId`, `includeDeleted`) and returns paginated results via `PagedResult<OrderResponse>`.

## Preconditions
- API is running at http://localhost:8080
- Test creates its own seed data (multiple orders with varying statuses and types)

## Steps

1. Create a customer, a seller, and a plant with inventory (setup data).
2. Create 5 orders:
   - Order 1: `isWalkUp=false`, Status=Open, linked to the customer and seller.
   - Order 2: `isWalkUp=true`, Status=Open.
   - Order 3: `isWalkUp=false`, Status=InProgress.
   - Order 4: `isWalkUp=false`, Status=Complete.
   - Order 5: `isWalkUp=false`, Status=Open, then soft-delete it.
3. **Filter by status**: Call `GET /api/orders?status=Open`. Assert returned items include Orders 1 and 2 but not 3, 4, or 5.
4. **Filter by isWalkUp**: Call `GET /api/orders?isWalkUp=true`. Assert only Order 2 is returned.
5. **Filter by sellerId**: Call `GET /api/orders?sellerId=$SELLER_ID`. Assert only Order 1 is returned (only order linked to that seller).
6. **Filter by customerId**: Call `GET /api/orders?customerId=$CUSTOMER_ID`. Assert only orders linked to that customer are returned.
7. **Include deleted**: Call `GET /api/orders?includeDeleted=true`. Assert Order 5 appears in the results.
8. **Exclude deleted (default)**: Call `GET /api/orders`. Assert Order 5 does not appear.
9. **Pagination**: Call `GET /api/orders?page=1&pageSize=2`. Assert `data.totalCount` reflects all non-deleted orders and `data.items` has at most 2 entries.
10. **Search**: Call `GET /api/orders?search={orderNumber}` using Order 1's `orderNumber`. Assert Order 1 is returned.

## Expected Results
- Each filter correctly narrows the result set
- Soft-deleted orders are excluded by default and included when `includeDeleted=true`
- Pagination returns the correct page size and total count
- Search matches on order number or customer name

## Execution Tool
bash -- `cd api && dotnet test --filter "EP16_ListOrdersWithFilters"`

## Pass / Fail Criteria
- **Pass:** All filter combinations return the expected subset of orders, pagination metadata is correct, and soft-deleted orders obey the `includeDeleted` flag.
- **Fail:** Any filter returns unexpected results, pagination counts are wrong, or soft-deleted orders appear when they should not.
