---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
master_spec: "../2026-04-25-walkup-cash-register-rewrite.md"
title: "WalkUpRegisterService -- backend"
---

# SS-02: WalkUpRegisterService -- backend

## Scope
Implement `IWalkUpRegisterService` (7 methods), matching controller, transactional scan with row locks, idempotency, audit, walk-up protection.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IWalkUpRegisterService.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/DTOs/WalkUpRegisterDtos.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Validators/...` (new validators)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/WalkUpRegisterService.cs` (new)
- `api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpRegisterController.cs` (new)
- `api/src/HamptonHawksPlantSales.Api/Program.cs` (DI registration)
- `api/tests/HamptonHawksPlantSales.Tests/WalkUp/WalkUpRegisterServiceTests.cs` (new)

## Patterns to Follow
- Row locking + retry: `FulfillmentService.ScanInternalAsync` with `BeginTransactionAsync` and `DbUpdateConcurrencyException` retry loop.
- Walk-up validation: `IInventoryProtectionService.ValidateWalkupLineAsync`.
- Audit: `IAdminService.LogActionAsync(actionType, targetEntity, targetId, reason, details)`.
- DI registration: `builder.Services.AddScoped<IWalkUpRegisterService, WalkUpRegisterService>();`.

## Implementation Steps (TDD)

1. **Add DTOs** `CreateDraftRequest`, `ScanIntoDraftRequest { string PlantBarcode; string ScanId }`, `AdjustLineRequest { Guid PlantCatalogId; int NewQty }`, `CloseDraftRequest { string? PaymentMethod; decimal? AmountTendered }`. Add validators.
2. **Define `IWalkUpRegisterService`** with the 7 methods listed in the master spec.
3. **Write failing test:** `WalkUpRegisterServiceTests.Scan_IdempotencyKeyDeduplicates`.
   - Seed plant + draft.
   - Call `ScanIntoDraftAsync(draftId, barcode, scanId="abc")` twice in parallel.
   - Assert: `Inventory.OnHandQty` decreased by exactly 1; `OrderLine.QtyFulfilled == 1`.
4. **Implement `CreateDraftAsync`:** insert `Order { Status=Draft, IsWalkUp=true, CustomerId=null, OrderNumber=GenerateNumber() }`. Save. Return mapped `OrderResponse`.
5. **Implement `ScanIntoDraftAsync`:**
   - `await using var tx = await _db.Database.BeginTransactionAsync();`
   - `SELECT * FROM PlantCatalog WHERE Barcode = @barcode FOR UPDATE` -> if not found: throw ValidationException (controller maps to 422).
   - Find existing `OrderLine` for this draft + plant (`SELECT FOR UPDATE`). If exists and `LastScanIdempotencyKey == request.ScanId`: return current state without changes (idempotent no-op).
   - Validate against `_protection.ValidateWalkupLineAsync(plantId, currentQty + 1, exclude_orderId=draftId)` -> if rejected: throw ValidationException.
   - Decrement `Inventory.OnHandQty -= 1` (`SELECT FOR UPDATE` on inventory row).
   - Upsert line: insert if new (QtyOrdered=1, QtyFulfilled=1); else `QtyOrdered+=1, QtyFulfilled+=1`. Set `LastScanIdempotencyKey = request.ScanId`.
   - Save and commit.
6. **Implement `AdjustLineAsync(orderId, lineId, newQty, adminPin, reason)`:** if newQty < current QtyFulfilled, restore inventory by the diff; if newQty > current and exceeds walk-up limit, require admin override (admin pin already validated by controller filter). Update line.
7. **Implement `VoidLineAsync(orderId, lineId, adminPin, reason)`:** restore inventory by `line.QtyFulfilled`, soft-delete line, log AdminAction.
8. **Implement `CancelDraftAsync(orderId, adminPin, reason)`:** for each line, restore inventory; soft-delete order; log per-line + cancellation AdminActions; commit in single transaction.
9. **Implement `CloseDraftAsync(orderId, paymentMethod, amountTendered)`:** validate >=1 line, set `Status=Completed`, persist payment metadata, commit.
10. **Implement `GetOpenDraftsAsync(workstationName)`:** return drafts where `Status=Draft` and `DeletedAt IS NULL`.
11. **Add controller** `WalkUpRegisterController` with route `api/walkup-register`. Endpoints: `POST /draft`, `POST /draft/{id}/scan`, `PATCH /draft/{id}/lines/{lineId}` (with `[RequiresAdminPin]` if reducing), `DELETE /draft/{id}/lines/{lineId}` (`[RequiresAdminPin]`), `POST /draft/{id}/close`, `POST /draft/{id}/cancel` (`[RequiresAdminPin]`), `GET /draft/open?workstationName=`.
12. **Register DI** in `Program.cs`.
13. **Run tests:** idempotency, parallel-different-scanIds, walk-up limit, override, void, cancel, close zero/many.
14. **Add concurrency test:** seed plant with `OnHandQty=1`. Two parallel scans on two different drafts. Exactly one succeeds; the other returns 422 (out of stock).

## Interface Contracts

### Provides
- `IWalkUpRegisterService` interface (consumed by SS-03 via HTTP).
- HTTP endpoints under `/api/walkup-register/...` (consumed by SS-03).
- Idempotency contract: client passes `scanId`; server enforces uniqueness on `(orderId, plantCatalogId, scanId)` via `LastScanIdempotencyKey`.

### Requires
- From SS-01: `OrderStatus.Draft`, nullable `Order.CustomerId`, `OrderLine.LastScanIdempotencyKey`.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter WalkUpRegisterServiceTests
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Service interface exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Interfaces/IWalkUpRegisterService.cs \|\| (echo "FAIL: IWalkUpRegisterService missing" && exit 1)` |
| Service implementation exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Infrastructure/Services/WalkUpRegisterService.cs \|\| (echo "FAIL: WalkUpRegisterService missing" && exit 1)` |
| Controller exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpRegisterController.cs \|\| (echo "FAIL: WalkUpRegisterController missing" && exit 1)` |
| Service uses transactions | [STRUCTURAL] | `grep -q "BeginTransactionAsync" api/src/HamptonHawksPlantSales.Infrastructure/Services/WalkUpRegisterService.cs \|\| (echo "FAIL: service not using transactions" && exit 1)` |
| Service uses idempotency key | [STRUCTURAL] | `grep -q "LastScanIdempotencyKey" api/src/HamptonHawksPlantSales.Infrastructure/Services/WalkUpRegisterService.cs \|\| (echo "FAIL: idempotency not enforced" && exit 1)` |
| Service registered in Program.cs | [STRUCTURAL] | `grep -q "IWalkUpRegisterService" api/src/HamptonHawksPlantSales.Api/Program.cs \|\| (echo "FAIL: DI registration missing" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Service tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter WalkUpRegisterServiceTests \|\| (echo "FAIL: register service tests failed" && exit 1)` |
