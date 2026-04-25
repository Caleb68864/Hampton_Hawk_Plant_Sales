---
sub_spec_id: SS-03
phase: run
depends_on: []
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Orders bulk actions -- backend"
---

# SS-03: Orders bulk actions -- backend

## Scope
Add `BulkCompleteAsync` and `BulkSetStatusAsync` to `IOrderService`. Add request DTOs + FluentValidation. Add new `OrdersController` actions. Per-order row locks + transactional commit. Returns per-order outcome list.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs` (modify -- add bulk DTOs)
- `api/src/HamptonHawksPlantSales.Core/Validators/BulkCompleteOrdersRequestValidator.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Validators/BulkSetOrderStatusRequestValidator.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs` (modify)
- `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkCompleteTests.cs` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkSetStatusTests.cs` (new)

## Patterns to Follow
- Row locking: copy shape from `FulfillmentService.ScanInternalAsync` -- `BeginTransactionAsync()` + `FromSqlRaw("SELECT ... FOR UPDATE")` or EF locking equivalent.
- `[RequiresAdminPin]`: copy from `OrdersController.ForceComplete` (existing).
- `AdminAction` logging: `IAdminService.LogActionAsync` with `(actionType, targetEntity, targetId, reason, details)`.
- DTO + FluentValidation: existing validators in `Core/Validators/`.

## Implementation Steps (TDD)

1. **Add DTOs** in `OrderDtos.cs`:
   - `BulkCompleteOrdersRequest { List<Guid> OrderIds }`.
   - `BulkSetOrderStatusRequest { List<Guid> OrderIds; OrderStatus TargetStatus }`.
   - `BulkOperationResult { List<BulkOrderOutcome> Outcomes }`.
   - `BulkOrderOutcome { Guid OrderId; string Outcome ("Completed"|"Skipped"|"StatusChanged"); string? Reason }`.
2. **Add validators:** non-empty array, max 500 items, valid enum value for target status.
3. **Write failing test:** `BulkCompleteTests.BulkComplete_FullyFulfilledOrdersComplete_PartiallyFulfilledSkipped`.
   - Seed 5 orders: 3 fully fulfilled, 2 partial.
   - Call `BulkCompleteAsync` with all 5 ids.
   - Expect: 3 outcomes "Completed", 2 outcomes "Skipped" with reason "unfulfilled lines".
4. **Implement `OrderService.BulkCompleteAsync`:**
   - `await using var tx = await _db.Database.BeginTransactionAsync();`
   - For each id (loop), use `_db.Orders.FromSqlInterpolated($"SELECT * FROM \"Orders\" WHERE \"Id\" = {id} FOR UPDATE").Include(o => o.OrderLines).FirstAsync();` (Postgres syntax).
   - Check eligibility: `order.OrderLines.Where(l => l.DeletedAt == null).All(l => l.QtyFulfilled >= l.QtyOrdered)`.
   - If eligible: `order.Status = OrderStatus.Completed;` + `await _adminService.LogActionAsync("BulkComplete", "Order", id, reason, $"Bulk-completed via /api/orders/bulk-complete; selected={ids.Count}")`.
   - If not eligible: outcome = "Skipped", reason = "unfulfilled lines".
   - `await _db.SaveChangesAsync();`
   - `await tx.CommitAsync();`
   - Return `BulkOperationResult` with outcomes.
5. **Implement `BulkSetStatusAsync`:** identical shape but no eligibility gate; sets `Status = targetStatus`; logs "BulkSetStatus" action with reason.
6. **Add controller endpoints:**
   ```csharp
   [HttpPost("bulk-complete")]
   [RequiresAdminPin]
   public async Task<IActionResult> BulkComplete(
       [FromBody] BulkCompleteOrdersRequest request,
       [FromServices] IValidator<BulkCompleteOrdersRequest> validator) { ... }
   ```
   - Read `HttpContext.Items["AdminReason"]` for reason.
7. **Run tests:** expect green.
8. **Add admin-pin missing test:** request without `X-Admin-Pin` returns 403.
9. **Add over-cap test:** 501 ids returns 400 + `ApiResponse.Fail`.
10. **Add concurrency test (integration):** simulate concurrent fulfillment scan on one of the bulk-completed orders; assert serialization (no inventory drift, both operations consistent).

## Interface Contracts

### Provides
- `BulkCompleteOrdersRequest`, `BulkSetOrderStatusRequest`, `BulkOperationResult`, `BulkOrderOutcome` DTOs (consumed by SS-04).
- `POST /api/orders/bulk-complete` and `POST /api/orders/bulk-status` endpoints (consumed by SS-04).

### Requires
- None.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter "BulkCompleteTests|BulkSetStatusTests"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| IOrderService has BulkCompleteAsync | [STRUCTURAL] | `grep -q "BulkCompleteAsync" api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs \|\| (echo "FAIL: BulkCompleteAsync not on interface" && exit 1)` |
| IOrderService has BulkSetStatusAsync | [STRUCTURAL] | `grep -q "BulkSetStatusAsync" api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs \|\| (echo "FAIL: BulkSetStatusAsync not on interface" && exit 1)` |
| Bulk request DTOs exist | [STRUCTURAL] | `grep -q "BulkCompleteOrdersRequest" api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs \|\| (echo "FAIL: BulkCompleteOrdersRequest missing" && exit 1)` |
| Bulk validators exist | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Validators/BulkCompleteOrdersRequestValidator.cs \|\| (echo "FAIL: BulkCompleteOrdersRequestValidator missing" && exit 1)` |
| OrdersController has bulk-complete route | [STRUCTURAL] | `grep -q "bulk-complete" api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs \|\| (echo "FAIL: bulk-complete route missing" && exit 1)` |
| Bulk endpoint uses transaction | [STRUCTURAL] | `grep -q "BeginTransactionAsync" api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs \|\| (echo "FAIL: bulk operations not transactional" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Bulk tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter "BulkCompleteTests|BulkSetStatusTests" \|\| (echo "FAIL: bulk tests failed" && exit 1)` |
