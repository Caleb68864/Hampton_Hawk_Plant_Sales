---
type: phase-spec
sub_spec: 8
title: "CRUD Pages (Plants, Inventory, Customers, Sellers, Orders)"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [7, 2]
---

# Sub-Spec 8: CRUD Pages

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 10.3 for search/lookup speed requirements, Section 10.5 for QoL features.

**Lookup UX rules:**
- A-Z tabs with letter hotkeys when input not focused
- `/` focuses search input
- Recent items in localStorage (last 10)
- Scan-to-search: text+Enter checks PickupCode → OrderNumber → normal search

---

## Implementation Steps

### Step 1: Plants List + Detail Pages

**Replace placeholders:**
- `/web/src/pages/plants/PlantsListPage.tsx`
  - Table with columns: Name, SKU, Barcode, Price, IsActive, Low Stock badge
  - SearchBar, PaginationControls
  - "New Plant" button → form modal or inline
  - Click row → PlantDetailPage
- `/web/src/pages/plants/PlantDetailPage.tsx`
  - Edit form: Name, SKU, Barcode, Variant, Price, IsActive
  - Unique SKU/Barcode validation on blur (call API)
  - BarcodeLockedAt indicator: if locked, show warning "Barcode locked -- admin required to edit"
  - Delete with ConfirmModal

**Verify:** `cd web && npm run build`

---

### Step 2: Inventory Page

**Replace placeholder:**
- `/web/src/pages/inventory/InventoryPage.tsx`
  - Table: Plant Name, SKU, OnHandQty, Low Stock badge (<5)
  - Inline edit: click OnHandQty → editable field with reason input
  - Adjustment modal: select plant, delta (+/-), reason, notes
  - Low inventory badge: red badge when OnHandQty < 5 (configurable threshold)
  - SearchBar, PaginationControls

**Verify:** `cd web && npm run build`

---

### Step 3: Customers List + Detail Pages

**Replace placeholders:**
- `/web/src/pages/customers/CustomersListPage.tsx`
  - AzTabs at top for last-name filtering
  - Letter hotkeys active when input not focused
  - SearchBar with scan-to-search (PickupCode detection)
  - Recent customers section (from localStorage, last 10 viewed)
  - Table: DisplayName, LastName, Phone, PickupCode
  - "New Customer" button
  - Click row → CustomerDetailPage + add to recent
- `/web/src/pages/customers/CustomerDetailPage.tsx`
  - Edit form: FirstName, LastName, DisplayName, Phone, Email, Notes
  - Show PickupCode (read-only after creation)
  - Show orders for this customer
  - Delete with ConfirmModal

**Create `/web/src/hooks/useRecentItems.ts`:**
- Generic hook: `useRecentItems<T>(key: string, maxItems: number)` → { items, addItem, clearItems }
- Stores in localStorage as JSON array
- Used for customers and sellers

**Verify:** `cd web && npm run build`

---

### Step 4: Sellers List + Detail Pages

**Replace placeholders:**
- `/web/src/pages/sellers/SellersListPage.tsx`
  - AzTabs for last-name filtering
  - Letter hotkeys
  - SearchBar
  - Recent sellers section (localStorage)
  - Table: DisplayName, LastName, Grade, Teacher
  - "New Seller" button
  - Click row → SellerDetailPage + add to recent
- `/web/src/pages/sellers/SellerDetailPage.tsx`
  - Edit form: FirstName, LastName, DisplayName, Grade, Teacher, Notes
  - Show orders for this seller
  - Delete with ConfirmModal

**Verify:** `cd web && npm run build`

---

### Step 5: Orders List Page

**Replace placeholder:**
- `/web/src/pages/orders/OrdersListPage.tsx`
  - Filters: status dropdown (All/Open/InProgress/Complete/Cancelled), isWalkUp toggle, seller dropdown, customer search
  - Table: OrderNumber, Customer, Seller, Status (StatusChip), IsWalkUp badge, HasIssue badge, Items progress
  - SearchBar (search by order number, customer name)
  - PaginationControls
  - "New Order" button → NewOrderPage
  - Click row → OrderDetailPage

**Verify:** `cd web && npm run build`

---

### Step 6: Order Detail Page

**Replace placeholder:**
- `/web/src/pages/orders/OrderDetailPage.tsx`
  - Order header: OrderNumber, Customer (link), Seller (link), Status chip, IsWalkUp badge, HasIssue badge
  - OrderLinesTable component:
    - Columns: Plant Name, SKU, Qty Ordered, Qty Fulfilled, Qty Remaining, progress bar
    - Add line button, edit line (inline or modal), delete line (ConfirmModal)
    - Fulfillment progress per line (green fill bar)
  - Action buttons: "Start Pickup" → navigate to /pickup/:orderId, "Print Order Sheet" → /print/order/:orderId
  - Admin actions: Force Complete (AdminPinModal), Reset Order (AdminPinModal)
  - Edit order: change customer, seller, notes
  - Order edit protection (spec Section 5.7): disable editing fulfilled lines

**Create `/web/src/components/OrderLinesTable.tsx`:**
- Reusable table for order lines with fulfillment progress
- Props: lines, editable, onAddLine, onEditLine, onDeleteLine

**Verify:** `cd web && npm run build`

---

### Step 7: New Order Page

**Replace placeholder:**
- `/web/src/pages/orders/NewOrderPage.tsx`
  - Select or create customer (search existing or inline create)
  - Select seller (optional, search existing)
  - Add line items: search/select plant, enter qty
  - Save → POST /api/orders with lines
  - Navigate to order detail on success

**Verify:** `cd web && npm run build`

---

### Step 8: Dashboard Page

**Replace placeholder:**
- `/web/src/pages/DashboardPage.tsx`
  - Metrics cards: Total Orders, Orders by Status, Items Fulfilled / Total
  - Sale Progress meter (percentage bar)
  - Low inventory list (top 10)
  - Problem orders list (top 10)
  - Quick links: Pickup, New Walk-Up, Imports

**Verify:** `cd web && npm run build`

---

### Step 9: Settings Page

**Replace placeholder:**
- `/web/src/pages/SettingsPage.tsx`
  - SaleClosed toggle switch
  - When toggling: AdminPinModal for PIN + reason
  - Current state display with SaleClosedAt timestamp

**Verify:** `cd web && npm run build`

---

## Interface Contracts

### Provides:
- All CRUD page implementations (replacing placeholders)
- OrderLinesTable reusable component
- useRecentItems hook
- Dashboard with metrics

### Requires (from Sub-Spec 7):
- All shared components (AzTabs, StatusChip, ConfirmModal, SearchBar, PaginationControls, AdminPinModal)
- API client functions
- Types
- Routing structure

### Requires (from Sub-Spec 2):
- All CRUD API endpoints running and returning data

---

## Verification Commands

**Build:** `cd web && npm run build`
**Type check:** `cd web && npx tsc --noEmit`
**Manual test:** Navigate each page, create/edit/delete entities, verify A-Z tabs work, verify recent items persist after refresh
