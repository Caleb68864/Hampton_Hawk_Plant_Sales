# Hampton Hawks Plant Sales -- Full Production Build

## Meta

| Field | Value |
|-------|-------|
| Client | Personal / School Fundraiser |
| Project | Hampton Hawks Plant Sales |
| Repo | Hampton_Hawk_Plant_Sales |
| Date | 2026-03-02 |
| Author | Caleb Bennett |
| Quality | 24/25 |
| Outcome | 5 |
| Scope | 5 |
| Edges | 5 |
| Criteria | 5 |
| Decomposition | 4 |

## Outcome

Build a production-ready plant fundraiser system that imports plant SKUs/inventory/orders, supports fast barcode-driven pickup with 2 concurrent stations, enforces walk-up inventory protection, and produces printable order sheets and cheat sheets. The system is a .NET 10 API + React/Vite/TypeScript/Tailwind SPA + PostgreSQL 16 deployed via Docker Compose. Done means: Docker Compose brings it up, all CRUD works, scanning fulfills correctly with concurrency safety, walk-up protection enforces, SaleClosed locks the system, printing and cheat sheets render cleanly, and documentation exists.

## Context

Greenfield project. Fresh repo with only `spec.md` and `LICENSE`. No existing code, no CLAUDE.md, no vault context. The complete specification lives in `spec.md` (1,093 lines) which serves as the authoritative source for all business rules, data model, API contract, and UX requirements.

**Tech stack:** .NET 10 (ASP.NET Core Web API), EF Core, Npgsql, FluentValidation, Serilog, Swashbuckle | React, TypeScript (strict), Vite, Tailwind CSS, React Router, Zustand, Axios | PostgreSQL 16 | Docker Compose

**Branding:** App title "Hampton Hawks Plant Sales", footer "Powered by Logic NE" on all pages and print views.

**Key constraints:**
- Barcode is unique per SKU (not per physical plant)
- Scan hard-blocks if SKU not on order (no auto-add)
- SaleClosed is absolute: no scanning/undo/manual fulfill even with admin PIN
- Walk-up orders cannot steal preorder inventory without admin override
- Soft delete everywhere (`DeletedAt`)
- 2-station concurrency safety via row-level locks

## Requirements

1. Docker Compose brings up Postgres, API, and Web successfully
2. Import Plants, Inventory, and Orders from CSV/Excel with best-effort error recording
3. CRUD for Plants, Inventory, Customers, Sellers, Orders, Order Lines
4. Pickup scan screen with barcode scanning, audio/visual feedback, undo, manual fulfill
5. Scan hard-blocks wrong-order SKUs, out-of-stock, already-fulfilled, and SaleClosed
6. Walk-up order creation enforces AvailableForWalkup = OnHandQty - PreorderRemaining
7. SaleClosed disables scan/undo/manual fulfill absolutely; admin can still force-complete and adjust inventory
8. Admin PIN gates forced completion, barcode edits, inventory threshold actions, SaleClosed toggle, order reset
9. All admin overrides logged to AdminAction table
10. A-Z tabs with letter hotkeys on lookup screens, Ctrl+K quick find, recent items in localStorage
11. Seller packets and customer order sheets print cleanly with page breaks
12. 4 cheat sheets (Pickup, Lookup, Admin, End-of-Day) print cleanly
13. Swagger with XML docs, Storybook for core components, TypeDoc generation
14. In-app `/docs` help page with workflow explanations
15. All list endpoints paginated (default 25, max 200)
16. All entities use UUID primary keys, timestamptz timestamps, soft delete
17. Response envelope: `{ success, data, errors }` on all endpoints
18. Backend tests for critical business rules (walk-up calc, SaleClosed blocks, wrong-order, scan accepted, admin force complete)
19. Footer "Powered by Logic NE" on all pages and print views

## Sub-Specs

### 1. Project Scaffolding + Docker + Database Schema

**Scope:** Create the full repository layout, .NET solution structure, React/Vite project, Docker Compose configuration, PostgreSQL database schema via EF Core migrations, and health checks. This is the foundation everything else builds on.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/` -- API project with Program.cs, health checks
- `/api/src/HamptonHawksPlantSales.Core/` -- domain models, enums, interfaces
- `/api/src/HamptonHawksPlantSales.Infrastructure/` -- EF Core DbContext, migrations, configurations
- `/api/tests/HamptonHawksPlantSales.Tests/` -- test project skeleton
- `/api/Dockerfile` -- multi-stage build
- `/web/` -- Vite + React + TypeScript project with Tailwind
- `/web/Dockerfile` -- multi-stage build with nginx
- `/docker-compose.yml` -- Postgres + API + Web
- `/api/HamptonHawksPlantSales.sln`

**Acceptance Criteria:**
1. `docker-compose up` starts all 3 services successfully
2. API health check responds at `/health`
3. PostgreSQL has all 11 tables created via EF Core migrations (AppSettings, PlantCatalog, Inventory, InventoryAdjustment, Seller, Customer, Order, OrderLine, FulfillmentEvent, ImportBatch, ImportIssue, AdminAction)
4. All tables have UUID PKs, `CreatedAt`/`UpdatedAt`/`DeletedAt` timestamps as specified
5. Web serves the React SPA at port 3000 with SPA fallback
6. Solution builds with `dotnet build`, web builds with `npm run build`

**Dependencies:** none

---

### 2. Core Entity Services + CRUD API

**Scope:** Implement all CRUD endpoints for Plants, Inventory, Sellers, Customers, Orders, and Order Lines. Includes the response envelope, FluentValidation, soft delete filtering, pagination, search, and the service layer pattern (controllers thin, services enforce rules).

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/` -- PlantsController, InventoryController, SellersController, CustomersController, OrdersController
- `/api/src/HamptonHawksPlantSales.Core/Services/` -- PlantService, InventoryService, SellerService, CustomerService, OrderService
- `/api/src/HamptonHawksPlantSales.Core/DTOs/` -- request/response DTOs for each entity
- `/api/src/HamptonHawksPlantSales.Core/Validators/` -- FluentValidation validators
- `/api/src/HamptonHawksPlantSales.Infrastructure/Repositories/` -- repository implementations

**Acceptance Criteria:**
1. All CRUD endpoints for Plants, Sellers, Customers, Orders, Order Lines return response envelope `{ success, data, errors }`
2. `GET` list endpoints support `?search=`, `?includeDeleted=`, pagination (`page`, `pageSize` default 25, max 200)
3. `DELETE` endpoints set `DeletedAt` (soft delete); records excluded from queries by default
4. Plant creation/update validates unique SKU and Barcode with friendly error messages
5. Customer creation auto-generates PickupCode if not provided
6. Order creation auto-generates OrderNumber if not provided
7. Inventory PUT and adjust endpoints work with `reason` required
8. Order line CRUD nested under `/api/orders/{id}/lines`
9. FluentValidation returns 400 with specific error messages

**Dependencies:** Sub-spec 1

---

### 3. Import System (CSV/Excel)

**Scope:** Implement CSV and Excel import for Plants, Inventory, and Orders. Best-effort import: valid rows import, errors recorded in ImportBatch/ImportIssue, import continues. Uses CsvHelper and ClosedXML.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/ImportController.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/ImportService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/PlantImportHandler.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/InventoryImportHandler.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/OrderImportHandler.cs`
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ImportDtos.cs`

**Acceptance Criteria:**
1. `POST /api/import/plants` accepts CSV/XLSX, imports valid rows, records ImportIssues for duplicates/missing fields
2. `POST /api/import/inventory` matches by SKU, creates Inventory rows if missing, overwrites OnHandQty if exists
3. `POST /api/import/orders` groups rows by OrderNumber, creates Customer/Seller/Order/OrderLine, skips unknown SKUs with ImportIssue
4. `GET /api/import/batches` returns import history
5. `GET /api/import/batches/{id}/issues` returns issues for a batch with filter/search
6. Each import returns TotalRows, ImportedCount, SkippedCount
7. Duplicate barcodes in plant import skip and log DuplicateBarcode issue
8. Orders import: blank PickupCode/OrderNumber auto-generated, blank Seller allowed, CustomerDisplayName required if first/last missing

**Dependencies:** Sub-spec 2

---

### 4. Scan + Fulfillment Engine

**Scope:** Implement the core scan workflow with all business rules, undo, manual fulfill, force complete, order reset. Includes row-level locking for 2-station concurrency, FulfillmentEvent logging, barcode lock trigger, and admin PIN enforcement.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/FulfillmentController.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/FulfillmentService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/AdminService.cs`
- `/api/src/HamptonHawksPlantSales.Api/Middleware/AdminPinMiddleware.cs` (or attribute/filter)
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ScanDtos.cs`

**Acceptance Criteria:**
1. `POST /api/orders/{id}/scan` with `{ "barcode": "..." }` follows full scan rules: SaleClosed→block, normalize→lookup→match order line→check fulfilled→check stock→accept with row locks
2. Every scan attempt creates a FulfillmentEvent with correct Result enum
3. Accepted scan transactionally decrements Inventory.OnHandQty and increments OrderLine.QtyFulfilled using `SELECT ... FOR UPDATE`
4. `POST /api/orders/{id}/undo-last-scan` reverses most recent Accepted event, restores inventory, blocked when SaleClosed
5. `POST /api/orders/{id}/complete` only succeeds when all lines QtyFulfilled==QtyOrdered
6. Admin force complete with PIN + reason succeeds even with unfulfilled lines, logs AdminAction
7. `POST /api/orders/{id}/reset` (admin) moves Complete→InProgress, logs AdminAction
8. BarcodeLockedAt set on first Accepted scan for each SKU
9. All admin endpoints require `X-Admin-Pin` + `X-Admin-Reason` headers, return 403 if missing/invalid
10. Concurrent scans from 2 stations for same SKU handled safely (no double-decrement)

**Dependencies:** Sub-spec 2

---

### 5. Walk-Up Orders + Inventory Protection

**Scope:** Implement walk-up order creation with AvailableForWalkup calculation and enforcement. Admin override for bypassing inventory protection.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpController.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/WalkUpService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/InventoryProtectionService.cs`

**Acceptance Criteria:**
1. `POST /api/walkup/orders` creates order with `IsWalkUp=true`, status Open
2. Adding/editing walk-up line items calculates `AvailableForWalkup = OnHandQty - SUM(preorder QtyOrdered - QtyFulfilled)`
3. If requested qty > AvailableForWalkup → 400 error with clear message
4. Admin override (PIN + reason) bypasses the check, logs AdminAction, sets `Order.HasIssue=true`
5. Preorder orders = `IsWalkUp=false AND Status != Cancelled AND DeletedAt IS NULL`

**Dependencies:** Sub-spec 4

---

### 6. Settings + SaleClosed + Reports API

**Scope:** Settings endpoints for SaleClosed toggle with admin enforcement. Dashboard metrics, low inventory, problem orders, and seller reports.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/SettingsController.cs`
- `/api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/SettingsService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/ReportService.cs`
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs`

**Acceptance Criteria:**
1. `GET /api/settings` returns SaleClosed state
2. `PUT /api/settings/sale-closed` requires admin PIN, toggles SaleClosed, sets SaleClosedAt, logs AdminAction
3. `GET /api/reports/dashboard-metrics` returns order counts by status, fulfillment progress, sale progress %
4. `GET /api/reports/low-inventory` returns plants below configurable threshold (default 5)
5. `GET /api/reports/problem-orders` returns orders with `HasIssue=true`
6. `GET /api/reports/seller/{sellerId}/orders` returns seller's orders with fulfillment summary
7. `GET /api/version` returns app version

**Dependencies:** Sub-spec 2

---

### 7. React SPA Shell + Routing + Global UX

**Scope:** Set up the React SPA shell with all routes, global layout (header, footer, SaleClosed banner), Zustand stores, shared components (StatusChip, ConfirmModal, QuickFindOverlay, AzTabs), audio feedback system, and keyboard shortcuts.

**Files:**
- `/web/src/App.tsx` -- router setup with all routes
- `/web/src/layouts/AppLayout.tsx` -- header, footer ("Powered by Logic NE"), SaleClosed banner
- `/web/src/stores/` -- appStore (settings), orderStore, etc.
- `/web/src/components/shared/` -- StatusChip, ConfirmModal, QuickFindOverlay, AzTabs, AudioFeedback
- `/web/src/hooks/` -- useKeyboardShortcuts, useAudioFeedback, useRecentItems
- `/web/src/api/` -- Axios client with response envelope typing
- `/web/src/types/` -- TypeScript interfaces matching all API DTOs

**Acceptance Criteria:**
1. All routes from Section 10.2 of spec are registered and render placeholder pages
2. Header shows "Hampton Hawks Plant Sales", footer shows "Powered by Logic NE" on every page
3. When SaleClosed=true (from API), persistent banner displays "SALE CLOSED: scanning disabled"
4. Ctrl+K opens QuickFindOverlay, Esc closes it
5. StatusChip renders correct colors: Open gray, InProgress blue, Complete green, Cancelled red, Problem amber
6. ConfirmModal shown on all delete actions
7. AzTabs component renders A-Z + # tabs with letter hotkey support
8. Audio feedback plays success/fail/warn sounds
9. Axios client wraps all API calls with typed response envelope
10. TypeScript interfaces match all API DTOs

**Dependencies:** Sub-spec 1

---

### 8. CRUD Pages (Plants, Inventory, Customers, Sellers, Orders)

**Scope:** Build all CRUD list/detail/form pages. Includes A-Z tabs and letter hotkeys on Customer/Seller lookup, recent items in localStorage, pagination, search, and filter UI.

**Files:**
- `/web/src/pages/plants/` -- PlantsListPage, PlantDetailPage
- `/web/src/pages/inventory/` -- InventoryPage (with adjustment modal)
- `/web/src/pages/customers/` -- CustomersListPage, CustomerDetailPage
- `/web/src/pages/sellers/` -- SellersListPage, SellerDetailPage
- `/web/src/pages/orders/` -- OrdersListPage, OrderDetailPage, NewOrderPage
- `/web/src/components/` -- OrderLinesTable, EntityForm, SearchBar, PaginationControls

**Acceptance Criteria:**
1. Plants page: list with search/filter, create/edit forms, unique barcode/SKU validation in UI
2. Inventory page: list with search, inline edit for OnHandQty with reason, adjustment modal
3. Customers page: list with A-Z tabs + letter hotkeys + search, recent customers (localStorage), create/edit forms
4. Sellers page: list with A-Z tabs + letter hotkeys + search, recent sellers (localStorage), create/edit forms
5. Orders page: list with status/walkup/seller/customer filters, order detail with lines table, create new order with line items
6. Order detail shows fulfillment progress per line
7. `/` focuses search input on lookup screens, `A-Z` jumps to tab when input not focused
8. All lists paginated with page controls
9. Low inventory badges on plants/inventory (<5 threshold)
10. Scan-to-search: text+Enter in search checks PickupCode then OrderNumber then normal search

**Dependencies:** Sub-spec 7, Sub-spec 2

---

### 9. Pickup Scan Screen

**Scope:** Build the POS-style pickup scan screen: big scan input always focused, Enter submits, audio/visual feedback, items remaining counter, last 10 scans, undo button, manual fulfill + reason, network failure banner, auto-refresh every 10 seconds, sticky focus, debounce.

**Files:**
- `/web/src/pages/pickup/` -- PickupLookupPage, PickupScanPage
- `/web/src/components/pickup/` -- ScanInput, ScanFeedbackBanner, ScanHistoryList, ManualFulfillModal, ItemsRemainingCounter
- `/web/src/hooks/useScanWorkflow.ts`

**Acceptance Criteria:**
1. PickupLookupPage: find order by customer/seller/order#/pickup code with A-Z tabs
2. PickupScanPage: big scan input always focused (returns focus after any action)
3. Enter submits barcode to `POST /api/orders/{id}/scan`
4. Big banner + audio plays on each scan result (green/success, red/fail, amber/warn)
5. "ITEMS REMAINING" big counter shows orderRemainingItems
6. Highlight/scroll to last fulfilled line in order lines table
7. Last 10 scans list shown below scan input
8. Undo last scan button calls `POST /api/orders/{id}/undo-last-scan`
9. Manual fulfill modal: select unfulfilled line + enter reason, blocked when SaleClosed
10. Duplicate scan debounce (2 seconds)
11. Network failure banner if API call fails
12. Auto-refresh every 10 seconds (polling)
13. Esc clears scan input, input always focused unless modal open

**Dependencies:** Sub-spec 7, Sub-spec 4

---

### 10. Printing (Order Sheets, Seller Packets, Cheat Sheets)

**Scope:** Build all print routes with print-friendly HTML and Tailwind. Order sheets, seller packets with toggles/sorting/page breaks, and 4 cheat sheets. Uses browser print, no PDF library.

**Files:**
- `/web/src/pages/print/` -- PrintOrderPage, PrintSellerPacketPage, PrintCheatsheetPickup, PrintCheatsheetLookup, PrintCheatsheetAdmin, PrintCheatsheetEndOfDay
- `/web/src/components/print/` -- PrintLayout, PrintHeader, OrderSheetTable
- `/web/src/styles/print.css`

**Acceptance Criteria:**
1. `/print/order/:orderId` renders order sheet with: header (title, customer, order#, pickup code large, seller, timestamp), table (checkbox, plant name, SKU, qty ordered/fulfilled/remaining), footer (notes, "Powered by Logic NE")
2. `/print/seller/:sellerId` renders all seller orders, one customer per page break, with toggles (preorders/walkups/completed) and sorting (last name/order#)
3. Pickup cheat sheet covers: find order, scan, colors/sounds, WrongOrder, undo, manual fulfill, SaleClosed
4. Lookup cheat sheet covers: A-Z tabs, hotkeys, Ctrl+K, printing
5. Admin cheat sheet covers: SaleClosed toggle, force complete, edit barcode, adjust inventory, reset order
6. End-of-day cheat sheet covers: dashboard, low inventory, problem orders, confirm sale closed, print packets
7. Print CSS: `.no-print` hides nav/buttons, `.page-break` forces breaks, grayscale-safe, thick checkboxes
8. All print views include "Powered by Logic NE" footer

**Dependencies:** Sub-spec 8

---

### 11. Import UI + Walk-Up UI

**Scope:** Build the import upload page with results display and the walk-up order creation page with inventory protection display.

**Files:**
- `/web/src/pages/imports/` -- ImportsPage (upload + results)
- `/web/src/pages/walkup/` -- WalkUpNewOrderPage
- `/web/src/components/imports/` -- FileUploader, ImportResultsSummary, ImportIssuesTable

**Acceptance Criteria:**
1. Import page: file upload for plants/inventory/orders (CSV and XLSX)
2. After import: shows TotalRows, ImportedCount, SkippedCount
3. Issues table with filter/search for import errors
4. Walk-up new order page: create customer inline or select existing, add line items
5. Each line item shows AvailableForWalkup count and blocks if exceeded
6. Admin override option with PIN entry and reason for walk-up inventory protection
7. Walk-up orders clearly marked in UI

**Dependencies:** Sub-spec 8, Sub-spec 3, Sub-spec 5

---

### 12. Documentation (Swagger, Storybook, TypeDoc, In-App Docs, README)

**Scope:** Set up Swagger with XML docs, Storybook for core components, TypeDoc generation, in-app docs page, and README.

**Files:**
- `/api/src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj` -- XML docs config
- `/web/.storybook/` -- Storybook config
- `/web/src/**/*.stories.tsx` -- stories for ScanInput, StatusChip, OrderLinesTable, QuickFindOverlay, AzTabs, PrintLayout
- `/web/typedoc.json`
- `/web/src/pages/DocsPage.tsx`
- `/README.md`
- `/docs/cheatsheets/` -- markdown versions of cheat sheets

**Acceptance Criteria:**
1. Swagger UI at `/swagger` (dev) includes XML doc summaries for all endpoints and DTOs
2. `npm run storybook` launches and shows stories for 6 core components
3. `npm run docs` generates TypeDoc output
4. `/docs` in-app page covers: scan workflow, SaleClosed behavior, admin override, walk-up protection, keyboard shortcuts, links to cheat sheets, common issues
5. README.md covers: what the app is, docker-compose instructions, env vars, access URLs, printing, SaleClosed admin

**Dependencies:** Sub-spec 9, Sub-spec 10

---

### 13. Backend Tests

**Scope:** Unit tests for critical business rules. Tests should be in the test project with mocked dependencies.

**Files:**
- `/api/tests/HamptonHawksPlantSales.Tests/Services/FulfillmentServiceTests.cs`
- `/api/tests/HamptonHawksPlantSales.Tests/Services/WalkUpServiceTests.cs`
- `/api/tests/HamptonHawksPlantSales.Tests/Services/AdminServiceTests.cs`

**Acceptance Criteria:**
1. Walk-up available calculation test: verify `AvailableForWalkup = OnHandQty - PreorderRemaining`
2. SaleClosed blocks test: scan, undo, and manual fulfill all return blocked
3. Wrong-order blocks test: scanning barcode not on order returns WrongOrder
4. Scan accepted test: decrements inventory, increments fulfillment, creates FulfillmentEvent
5. Admin force complete test: requires PIN, logs AdminAction, succeeds with unfulfilled lines
6. `dotnet test` passes all tests

**Dependencies:** Sub-spec 4, Sub-spec 5

## Edge Cases

1. **Inventory going negative**: Blocked by default. OnHandQty <= 0 prevents scan. Admin adjustments may go negative only with explicit override.
2. **Duplicate barcodes in import**: DB enforces unique. Import skips duplicates and records ImportIssue(DuplicateBarcode).
3. **Concurrent scans for same SKU from 2 stations**: Row-level `SELECT ... FOR UPDATE` on Inventory and OrderLine rows ensures atomic decrement.
4. **Scan on wrong order**: Hard block with FulfillmentEvent(WrongOrder). User must edit order to add SKU before re-scanning.
5. **Already-fulfilled line scanned again**: FulfillmentEvent(AlreadyFulfilled) returned, no state change.
6. **SaleClosed + any scan/undo/manual fulfill**: Always blocked, even with admin PIN. Creates FulfillmentEvent(SaleClosedBlocked).
7. **Walk-up exceeds available**: Blocked unless admin override with PIN + reason. Sets HasIssue=true on order.
8. **Order edit on fulfilled lines**: Cannot reduce QtyOrdered below QtyFulfilled, cannot delete fulfilled lines, cannot change PlantCatalogId on fulfilled lines.
9. **Barcode edit after scan**: Requires admin PIN + reason if BarcodeLockedAt is set. Logs AdminAction.
10. **Empty import file**: Returns TotalRows=0, ImportedCount=0, SkippedCount=0.
11. **Derived last name unparseable**: Goes to `#` tab in A-Z lookup.
12. **Network failure during scan**: Frontend shows persistent failure banner, retries on next auto-refresh.

## Out of Scope

- User authentication / roles (no login in v1, admin PIN only)
- CSV export from reports (v1 is view-only; import issues CSV download optional)
- PDF generation library (browser print only)
- Email notifications
- Multi-host deployment (Docker Compose single host only)
- Mobile-specific layouts
- Offline mode
- Payment processing
- Integration with external school systems

## Verification

End-to-end validation sequence:

1. `docker-compose up -d` -- all 3 services start and pass health checks
2. Import sample plants CSV with 10 SKUs, verify all imported
3. Import sample inventory CSV, verify OnHandQty set correctly
4. Import sample orders CSV with 5 orders (3 preorder, 2 with deliberate errors), verify 3 imported + 2 ImportIssues
5. Navigate to Plants CRUD, edit a plant name, verify saved
6. Navigate to Pickup, search for a customer by last name using A-Z tab
7. Open pickup screen, scan a valid barcode → Accepted with green flash + audio
8. Scan an invalid barcode → NotFound with red flash
9. Scan a barcode not on the order → WrongOrder hard block
10. Undo the last scan → inventory restored, fulfillment decremented
11. Create a walk-up order, try to exceed AvailableForWalkup → blocked
12. Admin override walk-up → succeeds, HasIssue set
13. Toggle SaleClosed via admin → scan/undo/manual fulfill all blocked
14. Force complete an order via admin → succeeds with unfulfilled lines
15. Print customer order sheet → clean printout with all fields
16. Print seller packet → one customer per page
17. Print all 4 cheat sheets → readable, grayscale-safe
18. Run `dotnet test` → all backend tests pass
19. Check Swagger at `/swagger` → all endpoints documented
20. Check footer on 3+ pages → "Powered by Logic NE" present
