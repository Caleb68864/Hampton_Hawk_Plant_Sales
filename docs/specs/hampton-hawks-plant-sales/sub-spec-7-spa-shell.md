---
type: phase-spec
sub_spec: 7
title: "React SPA Shell + Routing + Global UX"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [1]
---

# Sub-Spec 7: React SPA Shell + Routing + Global UX

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 10 for all UX requirements, Appendix A for keyboard shortcuts.

**Key UX principles:** Joy-to-use at a busy counter. Fast lookups, audio/visual feedback, keyboard-driven where possible.

---

## Implementation Steps

### Step 1: Create TypeScript Types (API DTOs)

**Create `/web/src/types/`:**
- `api.ts` -- `ApiResponse<T>`, `PagedResult<T>`, `PaginationParams`
- `plant.ts` -- `Plant`, `CreatePlantRequest`, `UpdatePlantRequest`
- `inventory.ts` -- `InventoryItem`, `UpdateInventoryRequest`, `AdjustInventoryRequest`
- `seller.ts` -- `Seller`, `CreateSellerRequest`
- `customer.ts` -- `Customer`, `CreateCustomerRequest`
- `order.ts` -- `Order`, `OrderLine`, `OrderStatus`, `CreateOrderRequest`
- `fulfillment.ts` -- `ScanRequest`, `ScanResponse`, `FulfillmentResult`, `FulfillmentEvent`
- `settings.ts` -- `AppSettings`
- `reports.ts` -- `DashboardMetrics`, `LowInventoryItem`, `ProblemOrder`
- `import.ts` -- `ImportBatch`, `ImportIssue`, `ImportResult`

**Verify:** `cd web && npx tsc --noEmit`

---

### Step 2: Create Axios API Client

**Create `/web/src/api/client.ts`:**
- Base Axios instance with `baseURL: '/api'`
- Response interceptor that unwraps `ApiResponse<T>` envelope
- Error interceptor that extracts error messages
- Helper functions: `get<T>`, `post<T>`, `put<T>`, `del<T>` with typed returns

**Create `/web/src/api/` -- one file per domain:**
- `plants.ts` -- CRUD functions for plants
- `inventory.ts` -- inventory queries and adjustments
- `sellers.ts` -- CRUD for sellers
- `customers.ts` -- CRUD for customers
- `orders.ts` -- CRUD for orders + lines
- `fulfillment.ts` -- scan, undo, complete, force-complete, reset, events
- `walkup.ts` -- walk-up order creation, lines, availability
- `imports.ts` -- file upload, batch list, issues
- `settings.ts` -- get settings, toggle sale closed
- `reports.ts` -- dashboard, low inventory, problems, seller orders

**Verify:** `cd web && npx tsc --noEmit`

---

### Step 3: Create Zustand Stores

**Create `/web/src/stores/`:**
- `appStore.ts` -- saleClosed state, settings loading, global app state
- `authStore.ts` -- admin PIN entry state (temporary PIN storage for session)

**appStore methods:**
- `fetchSettings()` -- GET /api/settings, update saleClosed
- `toggleSaleClosed(pin, reason)` -- PUT with admin headers

**Verify:** `cd web && npx tsc --noEmit`

---

### Step 4: Create App Layout

**Create `/web/src/layouts/AppLayout.tsx`:**
- Header: "Hampton Hawks Plant Sales" (large), nav links
- SaleClosed banner: persistent red bar "SALE CLOSED: scanning disabled" when saleClosed=true
- Footer: "Powered by Logic NE" (always visible)
- Main content area with `<Outlet />` for React Router
- On mount: fetch settings from API

**Nav links:** Dashboard, Plants, Inventory, Customers, Sellers, Orders, Pickup, Walk-Up, Imports, Reports, Settings, Docs

**Verify:** `cd web && npm run build`

---

### Step 5: Create Shared Components -- StatusChip

**Create `/web/src/components/shared/StatusChip.tsx`:**
- Props: `status: OrderStatus`, `hasIssue?: boolean`
- Colors: Open=gray, InProgress=blue, Complete=green, Cancelled=red
- If hasIssue: amber background regardless of status
- Renders as a small pill/badge

**Verify:** `cd web && npm run build`

---

### Step 6: Create Shared Components -- ConfirmModal

**Create `/web/src/components/shared/ConfirmModal.tsx`:**
- Props: `isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `confirmLabel`, `variant` (danger/warning/info)
- Overlay + centered modal with confirm/cancel buttons
- Danger variant: red confirm button

**Verify:** `cd web && npm run build`

---

### Step 7: Create Shared Components -- AzTabs

**Create `/web/src/components/shared/AzTabs.tsx`:**
- Renders A B C ... Z # tabs + "All" default
- Props: `activeTab`, `onTabChange`, `counts?` (optional per-letter counts)
- Keyboard support: when no input focused, pressing A-Z selects that tab, # selects # tab
- Compact horizontal layout suitable for top of list pages

**Create `/web/src/hooks/useAzHotkeys.ts`:**
- Hook that registers A-Z and # keyboard listeners
- Only active when no input/textarea focused
- `/` focuses search input

**Verify:** `cd web && npm run build`

---

### Step 8: Create Shared Components -- QuickFindOverlay

**Create `/web/src/components/shared/QuickFindOverlay.tsx`:**
- Ctrl+K opens overlay
- Search input auto-focused
- Searches customers (by name, pickup code), orders (by order number), sellers (by name)
- Results grouped by type
- Esc closes
- Enter on result navigates to detail page

**Create `/web/src/hooks/useKeyboardShortcuts.ts`:**
- Global listener for Ctrl+K → toggle QuickFindOverlay
- Esc → close overlays/modals

**Verify:** `cd web && npm run build`

---

### Step 9: Create Audio Feedback System

**Create `/web/src/hooks/useAudioFeedback.ts`:**
- Uses Web Audio API to generate tones (no audio files needed)
- `playSuccess()` -- short ascending two-tone beep
- `playError()` -- low buzzer tone
- `playWarning()` -- single medium-pitch beep
- Memoized AudioContext creation

**Create `/web/src/components/shared/AudioFeedback.tsx`:**
- Provider component that creates AudioContext on first user interaction
- Context for child components to call playSuccess/playError/playWarning

**Verify:** `cd web && npm run build`

---

### Step 10: Create Router with All Routes

**Modify `/web/src/App.tsx`:**
- React Router with all routes from spec Section 10.2:
  - `/` → DashboardPage (placeholder)
  - `/settings` → SettingsPage (placeholder)
  - `/plants` → PlantsListPage (placeholder)
  - `/plants/:id` → PlantDetailPage (placeholder)
  - `/inventory` → InventoryPage (placeholder)
  - `/customers` → CustomersListPage (placeholder)
  - `/customers/:id` → CustomerDetailPage (placeholder)
  - `/sellers` → SellersListPage (placeholder)
  - `/sellers/:id` → SellerDetailPage (placeholder)
  - `/orders` → OrdersListPage (placeholder)
  - `/orders/new` → NewOrderPage (placeholder)
  - `/orders/:id` → OrderDetailPage (placeholder)
  - `/pickup` → PickupLookupPage (placeholder)
  - `/pickup/:orderId` → PickupScanPage (placeholder)
  - `/walkup/new` → WalkUpNewOrderPage (placeholder)
  - `/imports` → ImportsPage (placeholder)
  - `/reports` → ReportsPage (placeholder)
  - `/docs` → DocsPage (placeholder)
  - `/print/order/:orderId` → PrintOrderPage (placeholder)
  - `/print/seller/:sellerId` → PrintSellerPacketPage (placeholder)
  - `/print/cheatsheet/pickup` → (placeholder)
  - `/print/cheatsheet/lookup` → (placeholder)
  - `/print/cheatsheet/admin` → (placeholder)
  - `/print/cheatsheet/end-of-day` → (placeholder)
- All routes wrapped in AppLayout (except print routes which use their own layout)
- Placeholder pages: simple `<h1>Page Name</h1>` with "Coming soon" text

**Verify:** `cd web && npm run build`

---

### Step 11: Create Admin PIN Entry Component

**Create `/web/src/components/shared/AdminPinModal.tsx`:**
- Modal with PIN input (password type) and reason textarea
- Used by any action requiring admin auth
- Returns `{ pin, reason }` on submit
- Reusable pattern: `const { requestAdminAuth } = useAdminAuth()` → opens modal, returns promise

**Create `/web/src/hooks/useAdminAuth.ts`:**
- Hook that manages admin PIN modal state
- `requestAdminAuth()` → Promise<{ pin: string, reason: string } | null>

**Verify:** `cd web && npm run build`

---

### Step 12: Create Common UI Components

**Create:**
- `/web/src/components/shared/SearchBar.tsx` -- search input with clear button, debounce
- `/web/src/components/shared/PaginationControls.tsx` -- page buttons, page size selector
- `/web/src/components/shared/LoadingSpinner.tsx`
- `/web/src/components/shared/EmptyState.tsx` -- "No results" with optional action button
- `/web/src/components/shared/ErrorBanner.tsx` -- dismissible error display

**Verify:** `cd web && npm run build`

---

## Interface Contracts

### Provides:
- Full routing structure (all routes registered with placeholders)
- AppLayout with header, footer, SaleClosed banner
- Shared components: StatusChip, ConfirmModal, AzTabs, QuickFindOverlay, AdminPinModal, SearchBar, PaginationControls, AudioFeedback
- Hooks: useAzHotkeys, useKeyboardShortcuts, useAudioFeedback, useAdminAuth, useRecentItems (localStorage)
- Zustand stores: appStore
- API client with typed functions for all domains
- TypeScript types for all API DTOs

### Requires (from Sub-Spec 1):
- Vite + React + TypeScript + Tailwind project configured
- API proxy configured in vite.config.ts

### Shared State:
- `App.tsx` -- routes added here; sub-spec 8, 9, 10, 11 replace placeholders
- `/web/src/api/` -- API functions used by all frontend sub-specs
- `/web/src/types/` -- types used by all frontend sub-specs
- `/web/src/stores/` -- stores used by all frontend sub-specs
- Shared components used by all page sub-specs

---

## Verification Commands

**Build:** `cd web && npm run build`
**Type check:** `cd web && npx tsc --noEmit`
**Dev server:** `cd web && npm run dev` → navigate to each route, verify no 404s
**Keyboard:** Ctrl+K opens QuickFind, Esc closes, A-Z tabs work on placeholder pages
