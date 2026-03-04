---
scenario_id: "SR-05"
title: "Pagination defaults and limits enforcement"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - pagination
---

# Scenario SR-05: Pagination defaults and limits enforcement

## Description

Verifies that the `PaginationParams` class enforces default page size (25), allows values up to 200, and caps any value above 200 to 200. Also verifies that page numbers below 1 default to 1.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The relevant services are registered in the DI container.
- 30 plant records exist in the database to test pagination.

## Steps

1. **Seed test data:** Insert 30 plants into the database with unique SKUs (PLT-001 through PLT-030).

### Default pagination

2. **Send request without page params:** `GET /api/plants`
   - Assert HTTP 200.
   - Assert `data.items` contains exactly 25 items (default pageSize).
   - Assert `data.totalCount` = 30.
   - Assert `data.page` = 1.
   - Assert `data.pageSize` = 25.
   - Assert `data.totalPages` = 2.

### Second page

3. **Send request for page 2:** `GET /api/plants?page=2&pageSize=25`
   - Assert `data.items` contains exactly 5 items (remaining 30 - 25).
   - Assert `data.page` = 2.

### Custom page size within limit

4. **Send request with pageSize=200:** `GET /api/plants?pageSize=200`
   - Assert `data.items` contains all 30 items.
   - Assert `data.pageSize` = 200.

### Page size exceeds maximum -- capped

5. **Send request with pageSize=201:** `GET /api/plants?pageSize=201`
   - Assert `data.pageSize` = 200 (capped from 201).
   - Assert `data.items` contains all 30 items (30 < 200, so all returned).

### Page size zero or negative -- defaults

6. **Send request with pageSize=0:** `GET /api/plants?pageSize=0`
   - Assert `data.pageSize` = 25 (default because value < 1).

7. **Send request with pageSize=-1:** `GET /api/plants?pageSize=-1`
   - Assert `data.pageSize` = 25 (default because value < 1).

### Page number below 1 -- defaults

8. **Send request with page=0:** `GET /api/plants?page=0`
   - Assert `data.page` = 1 (default because value < 1).

9. **Send request with page=-5:** `GET /api/plants?page=-5`
   - Assert `data.page` = 1 (default because value < 1).

## Expected Results

- Default pageSize = 25 when not specified.
- pageSize > 200 is capped to 200.
- pageSize < 1 defaults to 25.
- Page < 1 defaults to 1.
- Pagination metadata (`totalCount`, `page`, `pageSize`, `totalPages`) is accurate.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR05"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- defaults applied correctly, maximum enforced, invalid values handled gracefully, pagination metadata accurate.
- **Fail:** Any assertion fails -- wrong page size, maximum not enforced, invalid values not handled, or incorrect pagination metadata.
