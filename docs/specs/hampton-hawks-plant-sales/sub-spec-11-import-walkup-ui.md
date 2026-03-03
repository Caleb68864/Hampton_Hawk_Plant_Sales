---
type: phase-spec
sub_spec: 11
title: "Import UI + Walk-Up UI"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [8, 3, 5]
---

# Sub-Spec 11: Import UI + Walk-Up UI

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 9.4 for import results UI, Section 10.2 for walk-up route.

---

## Implementation Steps

### Step 1: Create File Uploader Component

**Create `/web/src/components/imports/FileUploader.tsx`:**
- Drop zone + file picker for CSV and XLSX
- Shows selected filename
- Upload button triggers API call
- Loading state during upload
- Accepts: `.csv`, `.xlsx`

**Verify:** `cd web && npm run build`

---

### Step 2: Create Import Results Components

**Create `/web/src/components/imports/ImportResultsSummary.tsx`:**
- Cards showing: TotalRows, ImportedCount, SkippedCount
- Green for imported, red for skipped, gray for total

**Create `/web/src/components/imports/ImportIssuesTable.tsx`:**
- Table: Row#, IssueType, SKU, Barcode, Message
- SearchBar to filter issues
- PaginationControls

**Verify:** `cd web && npm run build`

---

### Step 3: Create Imports Page

**Replace placeholder:**
- `/web/src/pages/imports/ImportsPage.tsx`

**Layout:**
- Three sections: "Import Plants", "Import Inventory", "Import Orders"
- Each section: FileUploader → on upload, show ImportResultsSummary
- If skippedCount > 0: expand ImportIssuesTable
- Import history tab: list of previous ImportBatches with click to view issues
- Expected column format hints for each import type

**Verify:** `cd web && npm run build`

---

### Step 4: Create Walk-Up New Order Page

**Replace placeholder:**
- `/web/src/pages/walkup/WalkUpNewOrderPage.tsx`

**Layout:**
- Step 1: Customer -- search existing or create new inline (DisplayName required)
- Step 2: Add line items
  - Search/select plant from catalog
  - Show for each plant: OnHandQty, PreorderRemaining, AvailableForWalkup (from `GET /api/walkup/availability`)
  - Enter qty -- validate against AvailableForWalkup in real-time
  - If qty > available: show warning, offer admin override (AdminPinModal)
- Step 3: Review + Create
  - Summary of all lines with availability info
  - Create button → POST /api/walkup/orders + add lines
  - Navigate to order detail on success

**Verify:** `cd web && npm run build`

---

## Interface Contracts

### Provides:
- Import page with file upload, results, and issue browsing
- Walk-up order creation page with inventory protection UI

### Requires (from Sub-Spec 8):
- Shared components, API client
- AdminPinModal for override

### Requires (from Sub-Spec 3):
- Import API endpoints running

### Requires (from Sub-Spec 5):
- Walk-up API endpoints + availability endpoint running

---

## Verification Commands

**Build:** `cd web && npm run build`
**Manual test:**
1. Upload a plants CSV → see results summary and any issues
2. Create walk-up order → verify available count shown per plant
3. Try to exceed available → verify block message
4. Admin override → verify succeeds with PIN
