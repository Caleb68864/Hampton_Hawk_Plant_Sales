---
type: phase-spec
sub_spec: 13
title: "Backend Tests"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [4, 5]
---

# Sub-Spec 13: Backend Tests

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 17 for testing requirements.

**Test framework:** xUnit (default for .NET). Use Moq or NSubstitute for mocking.

---

## Implementation Steps

### Step 1: Set Up Test Project Dependencies

**Modify `/api/tests/HamptonHawksPlantSales.Tests/HamptonHawksPlantSales.Tests.csproj`:**
- Add: `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Moq` (or `NSubstitute`), `FluentAssertions`
- Reference: `HamptonHawksPlantSales.Core`, `HamptonHawksPlantSales.Infrastructure`

**Verify:** `cd api && dotnet build`

---

### Step 2: Create Test Helpers

**Create `/api/tests/HamptonHawksPlantSales.Tests/Helpers/TestDataBuilder.cs`:**
- Helper methods to create test entities with sensible defaults:
  - `CreatePlant(sku, barcode, name)` → PlantCatalog
  - `CreateInventory(plantId, onHandQty)` → Inventory
  - `CreateOrder(customerId, isWalkUp, status, lines)` → Order with OrderLines
  - `CreateCustomer(displayName)` → Customer

**Create `/api/tests/HamptonHawksPlantSales.Tests/Helpers/MockDbContextFactory.cs`:**
- Creates in-memory or mocked DbContext for unit tests
- Pre-seeds AppSettings row

**Verify:** `cd api && dotnet build`

---

### Step 3: Write FulfillmentService -- Walk-Up Available Calculation Tests

**Create `/api/tests/HamptonHawksPlantSales.Tests/Services/WalkUpServiceTests.cs`:**

**Tests:**
- `CalculateAvailableForWalkup_NoPreorders_ReturnsFullInventory`
  - Plant with OnHandQty=10, no preorders → AvailableForWalkup=10
- `CalculateAvailableForWalkup_WithPreorders_SubtractsRemaining`
  - OnHandQty=10, preorder with QtyOrdered=8 QtyFulfilled=3 → remaining=5 → available=5
- `CalculateAvailableForWalkup_MultiplePreorders_SumsRemaining`
  - OnHandQty=10, two preorders with remaining 3 and 4 → available=3
- `CalculateAvailableForWalkup_CancelledOrdersExcluded`
  - OnHandQty=10, cancelled preorder with remaining=5 → available=10 (cancelled excluded)
- `CalculateAvailableForWalkup_WalkupOrdersExcluded`
  - OnHandQty=10, walkup order with remaining=3 → available=10 (walkups excluded from preorder calc)

**Verify:** `cd api && dotnet test --filter "WalkUpServiceTests"`

---

### Step 4: Write FulfillmentService -- SaleClosed Blocks Tests

**Create `/api/tests/HamptonHawksPlantSales.Tests/Services/FulfillmentServiceTests.cs`:**

**Tests:**
- `Scan_WhenSaleClosed_ReturnsSaleClosedBlocked`
  - Set AppSettings.SaleClosed=true → scan any barcode → result=SaleClosedBlocked
- `UndoLastScan_WhenSaleClosed_ReturnsError`
  - Set SaleClosed=true → undo → error returned, no state change
- `ManualFulfill_WhenSaleClosed_ReturnsError`
  - Set SaleClosed=true → manual fulfill → blocked

**Verify:** `cd api && dotnet test --filter "FulfillmentServiceTests"`

---

### Step 5: Write FulfillmentService -- Wrong Order Blocks Tests

**Add to FulfillmentServiceTests.cs:**

**Tests:**
- `Scan_BarcodeNotOnOrder_ReturnsWrongOrder`
  - Order has lines for plant A only → scan plant B barcode → WrongOrder
  - Verify FulfillmentEvent created with Result=WrongOrder
- `Scan_BarcodeNotFound_ReturnsNotFound`
  - Scan barcode that doesn't exist in PlantCatalog → NotFound
  - Verify FulfillmentEvent created with Result=NotFound
- `Scan_AlreadyFulfilled_ReturnsAlreadyFulfilled`
  - Line with QtyOrdered=1, QtyFulfilled=1 → scan → AlreadyFulfilled

**Verify:** `cd api && dotnet test --filter "FulfillmentServiceTests"`

---

### Step 6: Write FulfillmentService -- Scan Accepted Tests

**Add to FulfillmentServiceTests.cs:**

**Tests:**
- `Scan_ValidBarcode_AcceptsAndUpdatesCounters`
  - OnHandQty=10, QtyOrdered=3, QtyFulfilled=0 → scan → Accepted
  - Verify: OnHandQty=9, QtyFulfilled=1
  - Verify: FulfillmentEvent created with Result=Accepted
- `Scan_SetsBarcodeLocked_OnFirstAcceptedScan`
  - BarcodeLockedAt=null → accepted scan → BarcodeLockedAt set
- `Scan_OutOfStock_ReturnsOutOfStock`
  - OnHandQty=0 → scan → OutOfStock

**Verify:** `cd api && dotnet test --filter "FulfillmentServiceTests"`

---

### Step 7: Write AdminService -- Force Complete Tests

**Create `/api/tests/HamptonHawksPlantSales.Tests/Services/AdminServiceTests.cs`:**

**Tests:**
- `ForceComplete_WithPin_CompletesOrderWithUnfulfilledLines`
  - Order with unfulfilled lines → force complete with valid PIN → Status=Complete
  - Verify: AdminAction created with ActionType=ForceCompleteOrder
  - Verify: AdminAction.Reason contains the provided reason
- `ForceComplete_WithoutPin_Returns403`
  - Force complete without PIN header → 403 error
- `ForceComplete_WithBadPin_Returns403`
  - Force complete with wrong PIN → 403 error
- `ForceComplete_RecordsUnfulfilledSummary`
  - Order with 3 lines, 1 unfulfilled → AdminAction.Message contains unfulfilled line details

**Verify:** `cd api && dotnet test --filter "AdminServiceTests"`

---

### Step 8: Run All Tests

**Run:**
```bash
cd api && dotnet test
```

**Expected:** All tests pass. Minimum 15+ test cases across 3 test files.

---

## Interface Contracts

### Provides:
- Unit test suite covering 5 critical business rule categories
- Test helpers reusable for future test expansion
- CI-ready: `dotnet test` runs all tests

### Requires (from Sub-Spec 4):
- `FulfillmentService`, `AdminService` implementations
- All domain models and enums

### Requires (from Sub-Spec 5):
- `InventoryProtectionService`, `WalkUpService` implementations

---

## Verification Commands

**All tests:** `cd api && dotnet test`
**Specific category:** `cd api && dotnet test --filter "ClassName"`
**With output:** `cd api && dotnet test --verbosity normal`
