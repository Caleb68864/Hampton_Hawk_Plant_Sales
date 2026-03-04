---
scenario_id: "EP-29"
title: "List Customers with Search Filter"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - customers
---

## Description

Verify that `GET /api/customers?search=Smith` returns only customers matching the search term, and that pagination parameters work correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Customer` entity and related services are registered in the DI container.
- No pre-existing customer records exist in the database.

## Steps

1. **Seed test data:** Insert 3 customers into the database:
   - Customer A: `{ displayName: "John Smith", firstName: "John", lastName: "Smith", phone: "555-0101", email: "john.smith@example.com", notes: "Preorder regular" }`
   - Customer B: `{ displayName: "Jane Doe", firstName: "Jane", lastName: "Doe", phone: "555-0102", email: "jane.doe@example.com", notes: "" }`
   - Customer C: `{ displayName: "Bob Johnson", firstName: "Bob", lastName: "Johnson", phone: "555-0103", email: "bob.j@example.com", notes: "New customer" }`

2. **Send request:** `GET /api/customers?search=Smith`

3. **Verify filtered results:** Assert the response contains exactly 1 customer and that the `displayName` is `"John Smith"`.

4. **Verify pagination:** Send `GET /api/customers?search=Smith&page=1&pageSize=10` and confirm pagination metadata is present and correct (totalCount: 1).

5. **Verify empty search:** Send `GET /api/customers?search=Williams` and confirm 0 results returned with `success: true`.

6. **Verify no filter:** Send `GET /api/customers` and confirm all 3 customers are returned.

## Expected Results

- `GET /api/customers?search=Smith` returns `ApiResponse<T>` with `success: true` and `data` containing exactly 1 customer matching `"John Smith"`.
- Pagination metadata reflects the filtered count.
- Searching for a non-existent term returns an empty list with `success: true`.
- Omitting the search parameter returns all 3 customers.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP29"
```

## Pass/Fail Criteria

- **Pass:** Filtered results return only matching customers, pagination is correct, empty searches return zero results gracefully, and unfiltered queries return all records.
- **Fail:** Wrong number of results, missing pagination metadata, incorrect customer returned, or response envelope is malformed.
