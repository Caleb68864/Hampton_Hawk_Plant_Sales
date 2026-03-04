---
scenario_id: "EP-34"
title: "List Sellers with Search Filter"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - sellers
---

## Description

Verify that `GET /api/sellers?search=Jones` returns only sellers matching the search term, with correct filtering and pagination behavior.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Seller` entity and related services are registered in the DI container.
- No pre-existing seller records exist in the database.

## Steps

1. **Seed test data:** Insert 3 sellers into the database:
   - Seller A: `{ displayName: "Tommy Jones", firstName: "Tommy", lastName: "Jones", grade: "3rd", teacher: "Mrs. Parker", notes: "Top seller" }`
   - Seller B: `{ displayName: "Sally Kim", firstName: "Sally", lastName: "Kim", grade: "4th", teacher: "Mr. Rogers", notes: "" }`
   - Seller C: `{ displayName: "Max Rivera", firstName: "Max", lastName: "Rivera", grade: "3rd", teacher: "Mrs. Parker", notes: "New student" }`

2. **Send request:** `GET /api/sellers?search=Jones`

3. **Verify filtered results:** Assert the response contains exactly 1 seller and that the `displayName` is `"Tommy Jones"`.

4. **Verify pagination:** Send `GET /api/sellers?search=Jones&page=1&pageSize=10` and confirm pagination metadata is present and correct (totalCount: 1).

5. **Verify empty search:** Send `GET /api/sellers?search=Garcia` and confirm 0 results returned with `success: true`.

6. **Verify no filter:** Send `GET /api/sellers` and confirm all 3 sellers are returned.

## Expected Results

- `GET /api/sellers?search=Jones` returns `ApiResponse<T>` with `success: true` and `data` containing exactly 1 seller matching `"Tommy Jones"`.
- Pagination metadata reflects the filtered count.
- Searching for a non-existent term returns an empty list with `success: true`.
- Omitting the search parameter returns all 3 sellers.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP34"
```

## Pass/Fail Criteria

- **Pass:** Filtered results return only matching sellers, pagination is correct, empty searches return zero results, and unfiltered queries return all records.
- **Fail:** Wrong number of results, missing pagination metadata, incorrect seller returned, or response envelope is malformed.
