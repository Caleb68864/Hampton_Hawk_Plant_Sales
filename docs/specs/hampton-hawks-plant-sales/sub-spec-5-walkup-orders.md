---
type: phase-spec
sub_spec: 5
title: "Walk-Up Orders + Inventory Protection"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [4]
---

# Sub-Spec 5: Walk-Up Orders + Inventory Protection

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 5.2 for walk-up protection math, Section 5.4 for undo interaction.

**Walk-up protection formula:**
```
PreorderRemaining = SUM(OrderLine.QtyOrdered - OrderLine.QtyFulfilled)
  across orders WHERE IsWalkUp=false AND Status != Cancelled AND DeletedAt IS NULL
AvailableForWalkup = Inventory.OnHandQty - PreorderRemaining
```

---

## Implementation Steps

### Step 1: Create InventoryProtectionService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IInventoryProtectionService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/InventoryProtectionService.cs`

**Methods:**
- `GetAvailableForWalkupAsync(Guid plantCatalogId)` → int
- `ValidateWalkupLineAsync(Guid plantCatalogId, int requestedQty, Guid? excludeOrderId)` → (bool allowed, int available, string? errorMessage)

**Logic:**
- Query all non-cancelled, non-deleted, non-walkup orders
- Sum (QtyOrdered - QtyFulfilled) for the given PlantCatalogId across those orders
- Subtract from OnHandQty to get AvailableForWalkup
- If requestedQty > AvailableForWalkup → not allowed
- `excludeOrderId` used when editing existing walk-up order (exclude current order from calculation)

**Verify:** `cd api && dotnet build`

---

### Step 2: Create WalkUpService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IWalkUpService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/WalkUpService.cs`

**Methods:**
- `CreateWalkUpOrderAsync(CreateWalkUpOrderRequest request)` → OrderResponse
- `AddWalkUpLineAsync(Guid orderId, AddWalkUpLineRequest request)` → OrderLineResponse
- `UpdateWalkUpLineAsync(Guid orderId, Guid lineId, UpdateWalkUpLineRequest request)` → OrderLineResponse

**Logic for CreateWalkUpOrder:**
1. Create Customer if new (or link existing)
2. Create Order with IsWalkUp=true, Status=Open
3. Auto-generate OrderNumber

**Logic for AddWalkUpLine / UpdateWalkUpLine:**
1. Call `InventoryProtectionService.ValidateWalkupLineAsync`
2. If blocked → return 400 with available count message
3. Check if request includes admin override headers (from HttpContext)
4. If admin override: bypass check, log AdminAction, set Order.HasIssue=true
5. If allowed: create/update OrderLine

**Verify:** `cd api && dotnet build`

---

### Step 3: Create Walk-Up DTOs

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/WalkUpDtos.cs`
  - `CreateWalkUpOrderRequest` -- customerDisplayName (or customerId), optional customer fields
  - `AddWalkUpLineRequest` -- plantCatalogId, qty
  - `UpdateWalkUpLineRequest` -- qty
  - `WalkUpAvailabilityResponse` -- plantCatalogId, sku, name, onHand, preorderRemaining, availableForWalkup

**Verify:** `cd api && dotnet build`

---

### Step 4: Create WalkUpController

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpController.cs`

**Endpoints:**
- `POST /api/walkup/orders` -- create walk-up order
- `POST /api/walkup/orders/{id}/lines` -- add line with protection check
- `PUT /api/walkup/orders/{id}/lines/{lineId}` -- update line with protection check
- `GET /api/walkup/availability?plantCatalogId=` -- get available for walkup for a plant (used by UI)

**Admin override:** Lines endpoints accept `X-Admin-Pin` + `X-Admin-Reason` headers optionally. If present and valid, bypass protection.

**Verify:** `cd api && dotnet build`

---

### Step 5: Register Services + Test

**Register:** `IWalkUpService`, `IInventoryProtectionService` in DI

**Test sequence:**
```bash
# Setup: import plants, inventory, create preorder
# Plant has OnHandQty=10, preorder has QtyOrdered=8 → AvailableForWalkup=2

# Try walk-up for 3 → should fail
curl -X POST http://localhost:8080/api/walkup/orders -H "Content-Type: application/json" \
  -d '{"customerDisplayName":"Walk-In Customer"}'
curl -X POST http://localhost:8080/api/walkup/orders/<id>/lines -H "Content-Type: application/json" \
  -d '{"plantCatalogId":"<plantId>","qty":3}'
# Expected: 400, "Only 2 available for walk-up orders"

# Try walk-up for 2 → should succeed
curl -X POST http://localhost:8080/api/walkup/orders/<id>/lines -H "Content-Type: application/json" \
  -d '{"plantCatalogId":"<plantId>","qty":2}'
# Expected: 200, line created

# Admin override for 3 → should succeed
curl -X POST http://localhost:8080/api/walkup/orders/<id>/lines \
  -H "Content-Type: application/json" \
  -H "X-Admin-Pin: 1234" \
  -H "X-Admin-Reason: customer insists" \
  -d '{"plantCatalogId":"<plantId>","qty":3}'
# Expected: 200, HasIssue=true on order
```

---

## Interface Contracts

### Provides:
- `IInventoryProtectionService` -- reusable for any walk-up validation
- `IWalkUpService` -- walk-up order creation and line management
- Walk-up API endpoints
- `GET /api/walkup/availability` -- for frontend to show available counts

### Requires (from Sub-Spec 4):
- `IAdminService` for logging admin actions
- `[RequiresAdminPin]` attribute pattern
- Admin PIN validation in filter

### Requires (from Sub-Spec 2):
- `IOrderService`, `ICustomerService` for entity management
- `AppDbContext` for direct queries

---

## Verification Commands

**Build:** `cd api && dotnet build`

**Protection math test:** Create preorder with QtyOrdered=8 for plant with OnHandQty=10. Verify `GET /api/walkup/availability?plantCatalogId=X` returns availableForWalkup=2.
