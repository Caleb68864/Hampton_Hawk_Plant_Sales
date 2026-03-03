---
type: phase-spec
sub_spec: 9
title: "Pickup Scan Screen"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [7, 4]
---

# Sub-Spec 9: Pickup Scan Screen

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 10.4 for POS-style UX requirements, Section 10.5 for QoL features.

**This screen must feel like a POS terminal.** Speed, feedback, and focus management are critical. Volunteers with no training should be able to scan and fulfill.

---

## Implementation Steps

### Step 1: Create Pickup Lookup Page

**Replace placeholder:**
- `/web/src/pages/pickup/PickupLookupPage.tsx`
  - AzTabs for customer last-name filtering
  - SearchBar with scan-to-search (PickupCode → customer, OrderNumber → order)
  - Recent customers section
  - Results table: Customer Name, PickupCode, Order Count, Status
  - Click customer → show their orders
  - Click order → navigate to `/pickup/:orderId`

**Verify:** `cd web && npm run build`

---

### Step 2: Create ScanInput Component

**Create `/web/src/components/pickup/ScanInput.tsx`:**
- Large text input (big font, prominent border)
- Auto-focused on mount and after every action
- On Enter: submit barcode text, clear input, refocus
- On Esc: clear input
- 2-second debounce: if same barcode scanned within 2 seconds, ignore
- Ref-based focus management: `inputRef.current?.focus()` after modal close, after scan result, after any click outside

**Verify:** `cd web && npm run build`

---

### Step 3: Create ScanFeedbackBanner Component

**Create `/web/src/components/pickup/ScanFeedbackBanner.tsx`:**
- Full-width banner at top of scan area
- Colors by result:
  - Accepted: green background, "SCANNED: {plant name} ({qtyFulfilled}/{qtyOrdered})"
  - NotFound: red, "BARCODE NOT FOUND: {barcode}"
  - WrongOrder: red, "NOT ON THIS ORDER -- edit order to add"
  - AlreadyFulfilled: amber, "ALREADY FULFILLED: {plant name}"
  - OutOfStock: red, "OUT OF STOCK: {plant name}"
  - SaleClosedBlocked: red, "SALE CLOSED: scanning disabled"
- Flash animation: banner slides in, stays 5 seconds, fades
- Triggers audio feedback via useAudioFeedback

**Verify:** `cd web && npm run build`

---

### Step 4: Create useScanWorkflow Hook

**Create `/web/src/hooks/useScanWorkflow.ts`:**
- State: currentOrder, scanHistory (last 10), lastScanResult, isScanning, networkError
- Methods:
  - `loadOrder(orderId)` -- GET /api/orders/:id with lines
  - `scan(barcode)` -- POST /api/orders/:id/scan, update state, play audio
  - `undoLastScan()` -- POST /api/orders/:id/undo-last-scan
  - `refreshOrder()` -- re-fetch order data (for polling)
- Auto-refresh: setInterval every 10 seconds calls refreshOrder
- Network error: set networkError=true if any API call fails, clear on success
- Scan history: prepend each scan result, keep last 10

**Verify:** `cd web && npm run build`

---

### Step 5: Create Items Remaining Counter

**Create `/web/src/components/pickup/ItemsRemainingCounter.tsx`:**
- Large number display: total remaining items across all lines
- Calculation: SUM(QtyOrdered - QtyFulfilled) across order lines
- Green when 0 (all done), white/blue otherwise
- Animated countdown on each successful scan

**Verify:** `cd web && npm run build`

---

### Step 6: Create Scan History List

**Create `/web/src/components/pickup/ScanHistoryList.tsx`:**
- List of last 10 scans
- Each entry: timestamp, barcode, result, plant name (if found)
- Color-coded by result
- Most recent at top

**Verify:** `cd web && npm run build`

---

### Step 7: Create Manual Fulfill Modal

**Create `/web/src/components/pickup/ManualFulfillModal.tsx`:**
- Select unfulfilled line from dropdown (shows plant name, remaining qty)
- Enter reason (required)
- Submit calls a manual fulfill endpoint or uses scan with manual flag
- Blocked when SaleClosed (button disabled, tooltip explains)

**Verify:** `cd web && npm run build`

---

### Step 8: Assemble Pickup Scan Page

**Replace placeholder:**
- `/web/src/pages/pickup/PickupScanPage.tsx`

**Layout (top to bottom):**
1. Order header: Customer name, Order#, PickupCode, Status chip
2. ScanFeedbackBanner (hidden until first scan)
3. ScanInput (always focused)
4. ItemsRemainingCounter (large, centered)
5. OrderLinesTable (with highlight on last fulfilled line)
6. Action bar: Undo Last Scan button, Manual Fulfill button, Complete Order button
7. ScanHistoryList (collapsible)
8. Network failure banner (persistent red bar if networkError)

**Focus management:**
- After scan result: refocus ScanInput
- After modal close: refocus ScanInput
- After undo: refocus ScanInput
- Only time ScanInput loses focus: when a modal is open

**Highlight last fulfilled line:**
- After each Accepted scan, scroll to the line that was just fulfilled
- Briefly highlight it (green flash, 1 second)

**Complete button:**
- Enabled only when all lines QtyFulfilled==QtyOrdered
- On click: POST /api/orders/:id/complete
- If fails (unfulfilled lines): show error, offer Force Complete (AdminPinModal)

**Verify:** `cd web && npm run build`

---

## Interface Contracts

### Provides:
- Pickup lookup and scan screen (full POS experience)
- ScanInput, ScanFeedbackBanner, ScanHistoryList, ManualFulfillModal, ItemsRemainingCounter components
- useScanWorkflow hook

### Requires (from Sub-Spec 7):
- AudioFeedback, AzTabs, StatusChip, ConfirmModal, AdminPinModal, OrderLinesTable
- API client (fulfillment.ts)
- Types (ScanResponse, FulfillmentResult)

### Requires (from Sub-Spec 4):
- Scan, undo, complete, force-complete API endpoints running

---

## Verification Commands

**Build:** `cd web && npm run build`
**Type check:** `cd web && npx tsc --noEmit`
**Manual test:**
1. Create plant + inventory + order with lines
2. Navigate to /pickup, find customer
3. Open scan screen, type barcode + Enter → green banner + audio
4. Type wrong barcode → red banner
5. Click Undo → inventory restored
6. Verify 10-second auto-refresh
7. Verify focus stays on scan input after every action
