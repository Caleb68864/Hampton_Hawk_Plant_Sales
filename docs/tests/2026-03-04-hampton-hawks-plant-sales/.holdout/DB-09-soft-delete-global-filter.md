---
scenario_id: "DB-09"
title: "Soft delete global query filter across entity types"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - database
  - soft-delete
---

# Scenario DB-09: Soft delete global query filter across entity types

## Description

Verifies that the EF Core global query filter for soft delete works correctly across all major entity types (Customer, Plant, Seller, Order). Creating an entity, soft-deleting it, and querying via the default list endpoint should exclude the deleted entity. Querying with `includeDeleted=true` should include it with a non-null `DeletedAt` timestamp.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- All CRUD services are registered in the DI container.
- No pre-existing records in the database.

## Steps

### Customer soft delete

1. **Create a customer:** `POST /api/customers` with `{ "name": "Test Customer" }`. Record the returned customer ID.

2. **Verify customer visible:** `GET /api/customers` returns 1 customer.

3. **Soft-delete the customer:** `DELETE /api/customers/{customerId}`. Assert HTTP 200 with `success: true`.

4. **Verify customer excluded by default:** `GET /api/customers` returns 0 customers.

5. **Verify customer included with flag:** `GET /api/customers?includeDeleted=true` returns 1 customer with `deletedAt` set to a non-null DateTimeOffset.

### Plant soft delete

6. **Create a plant:** `POST /api/plants` with valid plant data. Record the returned plant ID.

7. **Verify plant visible:** `GET /api/plants` returns 1 plant.

8. **Soft-delete the plant:** `DELETE /api/plants/{plantId}`. Assert HTTP 200.

9. **Verify plant excluded by default:** `GET /api/plants` returns 0 plants.

10. **Verify plant included with flag:** `GET /api/plants?includeDeleted=true` returns 1 plant with `deletedAt` non-null.

### Seller soft delete

11. **Create a seller:** `POST /api/sellers` with valid seller data. Record the returned seller ID.

12. **Verify seller visible:** `GET /api/sellers` returns 1 seller.

13. **Soft-delete the seller:** `DELETE /api/sellers/{sellerId}`. Assert HTTP 200.

14. **Verify seller excluded by default:** `GET /api/sellers` returns 0 sellers.

15. **Verify seller included with flag:** `GET /api/sellers?includeDeleted=true` returns 1 seller with `deletedAt` non-null.

### Order soft delete

16. **Create an order:** `POST /api/orders` with valid order data. Record the returned order ID.

17. **Verify order visible:** `GET /api/orders` returns 1 order.

18. **Soft-delete the order:** `DELETE /api/orders/{orderId}`. Assert HTTP 200.

19. **Verify order excluded by default:** `GET /api/orders` returns 0 orders.

20. **Verify order included with flag:** `GET /api/orders?includeDeleted=true` returns 1 order with `deletedAt` non-null.

## Expected Results

- For each entity type (Customer, Plant, Seller, Order):
  - After soft-delete, the default list endpoint excludes the entity.
  - With `includeDeleted=true`, the entity appears with a non-null `deletedAt` timestamp.
  - The entity still exists in the database (soft delete, not hard delete).

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~DB09"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed for all 4 entity types -- soft-deleted entities excluded by default, included with `includeDeleted=true`, `deletedAt` timestamps present.
- **Fail:** Any assertion fails -- soft-deleted entity visible in default queries, missing from `includeDeleted` queries, or `deletedAt` is null after deletion.
