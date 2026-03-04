---
scenario_id: "EP-44"
title: "Import orders CSV with auto-creation of customers and sellers"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - import
---

# Scenario EP-44: Import orders CSV with auto-creation of customers and sellers

## Description

Verifies that `POST /api/import/orders` processes a CSV file containing order rows with customer names, seller names, plant SKUs, and quantities. The endpoint should create orders, auto-create customers and sellers that do not already exist, auto-generate OrderNumber values, and correctly link OrderLines to existing plants.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- Two plants exist in the database:
  - Plant A: `{ sku: "PLT-A", name: "Rose Bush", barcode: "1000000001" }` with Inventory `{ onHandQty: 50 }`
  - Plant B: `{ sku: "PLT-B", name: "Tulip Bulb", barcode: "1000000002" }` with Inventory `{ onHandQty: 50 }`
- No customers or sellers exist in the database.

## Steps

1. **Seed existing data:** Insert 2 plants with inventory as described in preconditions.

2. **Build CSV content:**
   ```csv
   CustomerName,SellerName,Sku,Quantity
   John Doe,Alice Smith,PLT-A,3
   John Doe,Alice Smith,PLT-B,2
   Jane Roe,Bob Jones,PLT-A,1
   ```

3. **Send request:** `POST /api/import/orders` with the CSV file as a multipart form upload.

4. **Assert response status:** HTTP 200 with `success: true`.

5. **Assert ImportResultResponse:**
   - `importedCount` >= 3 (3 rows successfully processed)
   - `issueCount` = 0

6. **Verify Customers created:** Query the `Customer` table. Confirm 2 customers exist: `"John Doe"` and `"Jane Roe"`.

7. **Verify Sellers created:** Query the `Seller` table. Confirm 2 sellers exist: `"Alice Smith"` and `"Bob Jones"`.

8. **Verify Orders created:** Query the `Order` table. Confirm orders exist linking to the correct customer and seller. Each unique customer-seller combination should produce an order.

9. **Verify OrderLines:** Confirm each order has the correct line items:
   - John Doe / Alice Smith order: 2 lines (PLT-A qty 3, PLT-B qty 2)
   - Jane Roe / Bob Jones order: 1 line (PLT-A qty 1)

10. **Verify OrderNumber auto-generated:** Each order has a non-empty `OrderNumber` value.

## Expected Results

- Response: `{ success: true, data: { importedCount: 3, issueCount: 0, ... } }`
- 2 customers auto-created (John Doe, Jane Roe).
- 2 sellers auto-created (Alice Smith, Bob Jones).
- Orders created with correct customer/seller associations and OrderLines.
- OrderNumbers are auto-generated and non-empty.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP44"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- orders created with correct associations, customers and sellers auto-created, OrderNumbers generated, no import issues.
- **Fail:** Any assertion fails -- missing customers/sellers, incorrect order associations, missing OrderLines, or empty OrderNumbers.
