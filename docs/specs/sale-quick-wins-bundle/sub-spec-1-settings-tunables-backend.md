---
sub_spec_id: SS-01
phase: run
depends_on: []
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Settings tunables -- backend foundation"
---

# SS-01: Settings tunables -- backend foundation

## Scope
Extend `AppSettings` with three new columns. Add EF migration with default values matching current hardcoded behavior. Extend `ISettingsService` and `SettingsController` with a tunables-update endpoint. Provide DTOs and FluentValidation. No frontend in this sub-spec.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs` (modify)
- `api/src/HamptonHawksPlantSales.Core/Enums/PickupAutoJumpMode.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/DTOs/SettingsDtos.cs` (modify)
- `api/src/HamptonHawksPlantSales.Core/Validators/UpdateScannerTuningRequestValidator.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/ISettingsService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/SettingsService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/AppSettingsConfiguration.cs` (modify)
- `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{ts}_AddScannerTunings.cs` (generated)
- `api/src/HamptonHawksPlantSales.Api/Controllers/SettingsController.cs` (modify)
- `api/tests/HamptonHawksPlantSales.Tests/Settings/ScannerTuningTests.cs` (new)

## Patterns to Follow
- DTO + FluentValidation: see `Core/Validators/CreateOrderRequestValidator.cs` (or similar).
- Controller with `[RequiresAdminPin]`: see `OrdersController.ForceComplete`.
- Service signature with reason capture: `HttpContext.Items["AdminReason"]`.
- Soft-delete + `BaseEntity` -- already in place on `AppSettings`.

## Implementation Steps (TDD)

1. **Write failing test:** `ScannerTuningTests.UpdateScannerTuning_PersistsValues`.
   - Test: PUT request with valid body persists fields and returns updated `SettingsResponse`.
   - Run `dotnet test --filter ScannerTuningTests` -- expect compilation failure (DTOs do not yet exist).
2. **Add `PickupAutoJumpMode` enum** with `ExactMatchOnly = 0`, `BestMatchWhenSingle = 1`. Default `BestMatchWhenSingle`.
3. **Extend `AppSettings`** with `PickupSearchDebounceMs` (int, default 120), `PickupAutoJumpMode` (enum, default `BestMatchWhenSingle`), `PickupMultiScanEnabled` (bool, default true).
4. **Update `AppSettingsConfiguration`** to map columns with non-null defaults.
5. **Generate migration:** `dotnet ef migrations add AddScannerTunings --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api`.
6. **Extend `SettingsResponse`** to include the three new fields.
7. **Add `UpdateScannerTuningRequest`** DTO with the three nullable fields.
8. **Add `UpdateScannerTuningRequestValidator`:** rules: `PickupSearchDebounceMs` between 50 and 500 when present; enum value valid; bool valid.
9. **Extend `ISettingsService`** with `UpdateScannerTuningAsync(UpdateScannerTuningRequest, string reason)`.
10. **Implement `SettingsService.UpdateScannerTuningAsync`:** load singleton row, set provided fields, save, log `AdminAction`.
11. **Add controller action** `PUT /api/settings/scanner-tuning` with `[RequiresAdminPin]`. Validate via injected `IValidator<UpdateScannerTuningRequest>`. Return `Ok(ApiResponse<SettingsResponse>.Ok(...))`.
12. **Run tests:** `dotnet test --filter ScannerTuningTests`. Expect green for happy path.
13. **Add validation tests:** out-of-range debounce returns 400 with descriptive message; missing admin pin returns 403.
14. **Verify migration applies cleanly:** `dotnet ef database update`. Confirm columns exist.

## Interface Contracts

### Provides
- `SettingsResponse` DTO -- extended shape with three new fields. Consumed by SS-02.
- `PickupAutoJumpMode` enum -- shared enum (will be referenced by frontend type definitions in SS-02).

### Requires
- None.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter ScannerTuningTests
dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| AppSettings has 3 new fields | [STRUCTURAL] | `grep -q "PickupSearchDebounceMs" api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs && grep -q "PickupAutoJumpMode" api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs && grep -q "PickupMultiScanEnabled" api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs \|\| (echo "FAIL: AppSettings missing one or more new fields" && exit 1)` |
| SettingsResponse exposes new fields | [STRUCTURAL] | `grep -q "PickupSearchDebounceMs" api/src/HamptonHawksPlantSales.Core/DTOs/SettingsDtos.cs \|\| (echo "FAIL: SettingsResponse missing new field" && exit 1)` |
| UpdateScannerTuningRequest validator exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Validators/UpdateScannerTuningRequestValidator.cs \|\| (echo "FAIL: validator missing" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter ScannerTuningTests \|\| (echo "FAIL: scanner tuning tests failed" && exit 1)` |
| Migration file exists | [STRUCTURAL] | `ls api/src/HamptonHawksPlantSales.Infrastructure/Migrations/*AddScannerTunings* >/dev/null 2>&1 \|\| (echo "FAIL: migration not generated" && exit 1)` |
