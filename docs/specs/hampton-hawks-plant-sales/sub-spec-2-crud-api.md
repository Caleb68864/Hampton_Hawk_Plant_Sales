---
type: phase-spec
sub_spec: 2
title: "Core Entity Services + CRUD API"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [1]
---

# Sub-Spec 2: Core Entity Services + CRUD API

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Sections 8.1-8.3 for API contract details, Section 4 for data model, Section 5.6-5.7 for barcode lock and order edit rules.

**Response envelope:** All endpoints return `{ "success": bool, "data": {}, "errors": [] }`
**Pagination:** `page` (1-based), `pageSize` (default 25, max 200)
**Soft delete:** `DELETE` sets `DeletedAt`, excluded by default, `?includeDeleted=true` to show

---

## Implementation Steps

### Step 1: Create Response Envelope + Pagination DTOs

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ApiResponse.cs` -- generic `ApiResponse<T>` with Success, Data, Errors
- `/api/src/HamptonHawksPlantSales.Core/DTOs/PagedResult.cs` -- Items, TotalCount, Page, PageSize, TotalPages
- `/api/src/HamptonHawksPlantSales.Core/DTOs/PaginationParams.cs` -- Page (default 1), PageSize (default 25, max 200)

**Verify:** `cd api && dotnet build`

---

### Step 2: Create Plant DTOs + Validator

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/PlantDtos.cs` -- CreatePlantRequest, UpdatePlantRequest, PlantResponse
- `/api/src/HamptonHawksPlantSales.Core/Validators/CreatePlantValidator.cs` -- Sku required, Barcode required, Name required
- `/api/src/HamptonHawksPlantSales.Core/Validators/UpdatePlantValidator.cs`

**Verify:** `cd api && dotnet build`

---

### Step 3: Create PlantService + IPlantService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IPlantService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/PlantService.cs`

**Methods:**
- `GetAllAsync(string? search, bool? activeOnly, bool includeDeleted, PaginationParams paging)` → PagedResult<PlantResponse>
- `GetByIdAsync(Guid id)` → PlantResponse?
- `CreateAsync(CreatePlantRequest request)` → PlantResponse (validate unique Sku + Barcode)
- `UpdateAsync(Guid id, UpdatePlantRequest request)` → PlantResponse (check BarcodeLockedAt for barcode edits -- admin check done later in sub-spec 4)
- `DeleteAsync(Guid id)` → bool (soft delete)

**Key logic:**
- Unique SKU check: query by Sku where Id != current, throw if exists
- Unique Barcode check: query by Barcode where Id != current, throw if exists
- Search: filter by Name, Sku, or Barcode containing search term

**Verify:** `cd api && dotnet build`

---

### Step 4: Create PlantsController

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/PlantsController.cs`

**Endpoints:**
- `GET /api/plants?search=&activeOnly=&includeDeleted=&page=&pageSize=`
- `POST /api/plants` -- body: CreatePlantRequest
- `GET /api/plants/{id}`
- `PUT /api/plants/{id}` -- body: UpdatePlantRequest
- `DELETE /api/plants/{id}`

**Pattern:** Controller calls service, wraps in ApiResponse, returns appropriate HTTP status.

**Verify:** `cd api && dotnet build`

---

### Step 5: Create Inventory DTOs + Service + Controller

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/InventoryDtos.cs` -- UpdateInventoryRequest (onHandQty, reason, notes), AdjustInventoryRequest (plantId, deltaQty, reason, notes), InventoryResponse (includes plant name/sku)
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IInventoryService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/InventoryService.cs`
- `/api/src/HamptonHawksPlantSales.Api/Controllers/InventoryController.cs`

**Endpoints:**
- `GET /api/inventory?search=` -- joins PlantCatalog for name/sku display
- `PUT /api/inventory/{plantId}` -- set OnHandQty, create InventoryAdjustment
- `POST /api/inventory/adjust` -- delta adjustment, create InventoryAdjustment

**Key logic:**
- Every inventory change creates an InventoryAdjustment record
- Reason is always required (validated)
- Admin PIN enforcement deferred to sub-spec 4 (middleware)

**Verify:** `cd api && dotnet build`

---

### Step 6: Create Seller DTOs + Service + Controller

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/SellerDtos.cs`
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/ISellerService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/SellerService.cs`
- `/api/src/HamptonHawksPlantSales.Api/Controllers/SellersController.cs`

**Endpoints:** standard CRUD at `/api/sellers`
**Search:** filter by DisplayName, LastName containing search term

**Verify:** `cd api && dotnet build`

---

### Step 7: Create Customer DTOs + Service + Controller

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/CustomerDtos.cs`
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/ICustomerService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/CustomerService.cs`
- `/api/src/HamptonHawksPlantSales.Api/Controllers/CustomersController.cs`

**Endpoints:** standard CRUD at `/api/customers`
**Key logic:**
- Auto-generate PickupCode on create if not provided (e.g., 6-char alphanumeric)
- Search: filter by DisplayName, LastName, Phone, PickupCode

**Verify:** `cd api && dotnet build`

---

### Step 8: Create Order + OrderLine DTOs + Service + Controller

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs` -- CreateOrderRequest, UpdateOrderRequest, OrderResponse (with lines, customer, seller), AddOrderLineRequest, UpdateOrderLineRequest
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/OrderService.cs`
- `/api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs`

**Endpoints:**
- `GET /api/orders?search=&status=&isWalkUp=&sellerId=&customerId=&includeDeleted=&page=&pageSize=`
- `POST /api/orders` (auto OrderNumber if missing)
- `GET /api/orders/{id}` -- includes lines with plant info, customer, seller
- `PUT /api/orders/{id}`
- `DELETE /api/orders/{id}`
- `POST /api/orders/{id}/lines`
- `PUT /api/orders/{id}/lines/{lineId}`
- `DELETE /api/orders/{id}/lines/{lineId}`

**Key logic (spec Section 5.7):**
- Cannot reduce QtyOrdered below QtyFulfilled on update
- Cannot delete lines with QtyFulfilled > 0
- Cannot change PlantCatalogId on fulfilled lines (QtyFulfilled > 0)
- Auto-generate OrderNumber on create if not provided

**Verify:** `cd api && dotnet build`

---

### Step 9: Register All Services in DI + Configure Pipeline

**Modify `/api/src/HamptonHawksPlantSales.Api/Program.cs`:**
- Register all services: `builder.Services.AddScoped<IPlantService, PlantService>()` etc.
- Register FluentValidation: `builder.Services.AddValidatorsFromAssemblyContaining<CreatePlantValidator>()`
- Add global exception handler middleware that returns ApiResponse with errors
- Configure JSON serialization: camelCase, ignore nulls, enum as string

**Verify:** `cd api && dotnet build`

---

### Step 10: Integration Smoke Test

**Run:**
```bash
docker-compose up -d --build
```

**Test each endpoint manually or via curl:**
```bash
# Create a plant
curl -X POST http://localhost:8080/api/plants -H "Content-Type: application/json" -d '{"sku":"TOM-CHERRY","name":"Cherry Tomato","barcode":"123456"}'

# List plants
curl http://localhost:8080/api/plants

# Create customer
curl -X POST http://localhost:8080/api/customers -H "Content-Type: application/json" -d '{"displayName":"John Smith"}'

# Create order
curl -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"customerId":"<id-from-above>"}'
```

---

## Interface Contracts

### Provides:

**API Endpoints:** All CRUD for Plants, Inventory, Sellers, Customers, Orders, OrderLines
**Response Pattern:** `ApiResponse<T>` envelope used by all controllers
**Service Layer:** All `I*Service` interfaces + implementations registered in DI
**DTOs:** All request/response DTOs in `HamptonHawksPlantSales.Core.DTOs`
**Pagination:** `PagedResult<T>` + `PaginationParams` used by all list endpoints
**Validators:** FluentValidation validators for create/update requests

### Requires (from Sub-Spec 1):

- `AppDbContext` with all entity DbSets
- All domain models in `Core.Models`
- All enums in `Core.Enums`
- Program.cs with DI container ready for service registration

### Shared State:
- `Program.cs` -- sub-spec 4 adds admin middleware, sub-spec 3 adds import controller
- `AppDbContext` -- shared across all API sub-specs
- DTOs namespace -- sub-spec 4 adds ScanDtos, sub-spec 3 adds ImportDtos

---

## Verification Commands

**Build:** `cd api && dotnet build`

**Docker:** `docker-compose up -d --build`

**Smoke test:**
```bash
curl http://localhost:8080/api/plants
curl http://localhost:8080/api/sellers
curl http://localhost:8080/api/customers
curl http://localhost:8080/api/orders
curl http://localhost:8080/api/inventory
```

All should return `{ "success": true, "data": { "items": [], ... }, "errors": [] }`
