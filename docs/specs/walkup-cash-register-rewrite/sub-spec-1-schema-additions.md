---
sub_spec_id: SS-01
phase: run
depends_on: []
master_spec: "../2026-04-25-walkup-cash-register-rewrite.md"
title: "Schema additions -- OrderStatus.Draft, nullable CustomerId, payment metadata"
---

# SS-01: Schema additions

## Scope
Add `Draft` to `OrderStatus`. Make `Order.CustomerId` nullable. Add `Order.PaymentMethod` (string?), `Order.AmountTendered` (decimal?), `OrderLine.LastScanIdempotencyKey` (string?, indexed). Update soft-delete and reports queries to exclude `Draft` by default.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Enums/OrderStatus.cs`
- `api/src/HamptonHawksPlantSales.Core/Models/Order.cs`
- `api/src/HamptonHawksPlantSales.Core/Models/OrderLine.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/OrderConfiguration.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/OrderLineConfiguration.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` (Draft default-exclude)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs` (Draft exclusion)
- `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{ts}_WalkUpRegisterSchema.cs` (generated)

## Implementation Steps

1. **Add enum value** `Draft` to `OrderStatus` (lowest unused integer; verify no migration relies on enum-int mapping).
2. **Modify `Order.cs`:**
   - `CustomerId` -> `Guid?`.
   - Add `PaymentMethod` (string?) and `AmountTendered` (decimal?).
3. **Modify `OrderLine.cs`:** add `LastScanIdempotencyKey` (string?, max length 64).
4. **Update `OrderConfiguration`:** mark CustomerId nullable; configure new columns.
5. **Update `OrderLineConfiguration`:** add `LastScanIdempotencyKey` with non-unique index.
6. **Update OrderResponse DTO** to expose new fields.
7. **Update `OrderService.GetAllAsync`:** add a default filter `o.Status != OrderStatus.Draft` unless an `includeDraft=true` parameter is passed; thread param through controller (additive, default false).
8. **Update `ReportService` aggregate methods:** ensure `o.Status != OrderStatus.Draft` filter applied where revenue is summed.
9. **Generate migration:** `dotnet ef migrations add WalkUpRegisterSchema --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api`.
10. **Apply migration:** `dotnet ef database update`.
11. **Run existing test suite:** ensure no regression from CustomerId nullability or filter changes.

## Interface Contracts

### Provides
- `OrderStatus.Draft` value (consumed by SS-02).
- `Order.PaymentMethod`, `Order.AmountTendered`, `Order.CustomerId?` shape (consumed by SS-02).
- `OrderLine.LastScanIdempotencyKey` column (consumed by SS-02 for idempotent scan).

### Requires
- None.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet
dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| OrderStatus.Draft exists | [STRUCTURAL] | `grep -q "Draft" api/src/HamptonHawksPlantSales.Core/Enums/OrderStatus.cs \|\| (echo "FAIL: OrderStatus.Draft missing" && exit 1)` |
| Order.CustomerId nullable | [STRUCTURAL] | `grep -q "Guid? CustomerId" api/src/HamptonHawksPlantSales.Core/Models/Order.cs \|\| (echo "FAIL: Order.CustomerId not nullable" && exit 1)` |
| Order has PaymentMethod | [STRUCTURAL] | `grep -q "PaymentMethod" api/src/HamptonHawksPlantSales.Core/Models/Order.cs \|\| (echo "FAIL: Order.PaymentMethod missing" && exit 1)` |
| OrderLine has idempotency key | [STRUCTURAL] | `grep -q "LastScanIdempotencyKey" api/src/HamptonHawksPlantSales.Core/Models/OrderLine.cs \|\| (echo "FAIL: idempotency key missing" && exit 1)` |
| Migration exists | [STRUCTURAL] | `ls api/src/HamptonHawksPlantSales.Infrastructure/Migrations/*WalkUpRegisterSchema* >/dev/null 2>&1 \|\| (echo "FAIL: migration not generated" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet \|\| (echo "FAIL: test suite failed" && exit 1)` |
