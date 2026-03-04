---
scenario_id: "SR-06"
title: "Soft delete excludes records from default queries for all entity types"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - soft-delete
---

# Scenario SR-06: Soft delete excludes records from default queries for all entity types

## Description

Verifies that all entity types (Plant, Customer, Seller, Order) that extend `BaseEntity` respect the EF Core global query filter for soft delete. Soft-deleted entities must be excluded from default list and get-by-id queries. This scenario validates the spec requirement from the architecture rules.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete (filtering on `DeletedAt == null`).
- All CRUD services are registered in the DI container.
- No pre-existing records in the database.

## Steps

### Plant

1. **Create 2 plants.** Soft-delete Plant A.
2. `GET /api/plants` returns only Plant B (1 result).
3. `GET /api/plants/{plantAId}` returns HTTP 404 (soft-deleted).
4. `GET /api/plants/{plantBId}` returns HTTP 200 (active).

### Customer

5. **Create 2 customers.** Soft-delete Customer A.
6. `GET /api/customers` returns only Customer B (1 result).
7. `GET /api/customers/{customerAId}` returns HTTP 404.
8. `GET /api/customers/{customerBId}` returns HTTP 200.

### Seller

9. **Create 2 sellers.** Soft-delete Seller A.
10. `GET /api/sellers` returns only Seller B (1 result).
11. `GET /api/sellers/{sellerAId}` returns HTTP 404.
12. `GET /api/sellers/{sellerBId}` returns HTTP 200.

### Order

13. **Create 2 orders.** Soft-delete Order A.
14. `GET /api/orders` returns only Order B (1 result).
15. `GET /api/orders/{orderAId}` returns HTTP 404.
16. `GET /api/orders/{orderBId}` returns HTTP 200.

## Expected Results

- For each entity type, the soft-deleted record:
  - Does not appear in the list endpoint response.
  - Returns HTTP 404 on the get-by-id endpoint.
- Active records remain accessible via both list and get-by-id endpoints.
- The global query filter is applied consistently across all entity types.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR06"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- soft-deleted entities excluded from defaults across all 4 entity types, 404 returned for get-by-id on deleted entities.
- **Fail:** Any assertion fails -- soft-deleted entity appears in default queries, or returns 200 on get-by-id after deletion.
