---
type: phase-spec
sub_spec: 10
title: "Printing (Order Sheets, Seller Packets, Cheat Sheets)"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [8]
---

# Sub-Spec 10: Printing

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 11 for print layout, Section 14 for cheat sheet content, Section 11.5 for print CSS.

**Approach:** Browser print only. No PDF generation library. Print-friendly HTML with Tailwind + `@media print` CSS.

---

## Implementation Steps

### Step 1: Create Print CSS

**Create `/web/src/styles/print.css`:**
```css
@media print {
  .no-print { display: none !important; }
  .page-break { page-break-after: always; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

- Import in main CSS or App.tsx
- Thick checkbox squares: `.print-checkbox { width: 20px; height: 20px; border: 2px solid #000; display: inline-block; }`
- Grayscale-safe: avoid relying on color alone for meaning

**Verify:** `cd web && npm run build`

---

### Step 2: Create PrintLayout Component

**Create `/web/src/components/print/PrintLayout.tsx`:**
- Wrapper for all print pages
- Hides AppLayout nav/footer (print pages use their own)
- Shows "Print" button (hidden in print) and "Back" link
- Auto-triggers `window.print()` option

**Create `/web/src/components/print/PrintHeader.tsx`:**
- "Hampton Hawks Plant Sales" title
- Subtitle (e.g., "Customer Order Sheet")
- Optional fields: customer name, order number, pickup code (large), seller, timestamp

**Create `/web/src/components/print/PrintFooter.tsx`:**
- Notes lines (blank lines for handwriting)
- "Powered by Logic NE" subtle footer

**Verify:** `cd web && npm run build`

---

### Step 3: Create Print Order Page

**Replace placeholder:**
- `/web/src/pages/print/PrintOrderPage.tsx`

**Layout (spec Section 11.3):**
- PrintHeader: "Hampton Hawks Plant Sales", "Customer Order Sheet", customer name, order number, pickup code (LARGE), seller name, printed timestamp
- Table columns: checkbox square (thick border for pen), Plant Name, SKU, Qty Ordered, Qty Fulfilled, Qty Remaining
- PrintFooter: notes lines, "Powered by Logic NE"
- Fetches order by ID from API on mount

**Verify:** `cd web && npm run build`

---

### Step 4: Create Print Seller Packet Page

**Replace placeholder:**
- `/web/src/pages/print/PrintSellerPacketPage.tsx`

**Layout (spec Section 11.4):**
- Fetches all orders for seller from API
- Toggle controls (hidden in print): Include Preorders (default on), Include Walk-ups (default on), Include Completed (default off)
- Sort options: Customer Last Name (default), Order Number
- For each order: render full order sheet (reuse PrintOrderPage layout)
- `.page-break` after each customer
- Print button triggers `window.print()`

**Verify:** `cd web && npm run build`

---

### Step 5: Create Pickup Cheat Sheet

**Replace placeholder:**
- `/web/src/pages/print/PrintCheatsheetPickup.tsx`

**Content (spec Section 14.2 #1):**
- "Pickup Station Quick Reference"
- How to find an order: search by name, pickup code, or order number
- How to scan: place cursor in scan box, scan barcode, check result
- Colors/sounds: Green=success, Red=error, Amber=warning
- WrongOrder: "This item is not on the order. Go to the order page and add the item, then try scanning again."
- Undo: click "Undo Last Scan" button
- Manual fulfill: click "Manual Fulfill", select item, enter reason
- SaleClosed: "When sale is closed, scanning is disabled. Contact admin."

**Verify:** `cd web && npm run build`

---

### Step 6: Create Lookup, Admin, End-of-Day Cheat Sheets

**Replace placeholders:**

**PrintCheatsheetLookup.tsx (spec Section 14.2 #2):**
- A-Z tabs: click letter to filter by last name
- Letter hotkeys: press A-Z on keyboard (when not typing)
- Ctrl+K: opens quick search overlay
- Print customer order: Orders page → click order → Print button
- Print seller packet: Sellers page → click seller → Print Packet button

**PrintCheatsheetAdmin.tsx (spec Section 14.2 #3):**
- Toggle SaleClosed: Settings page → toggle switch → enter PIN + reason
- Force complete order: Order detail → Force Complete → enter PIN + reason
- Edit locked barcode: Plants page → edit plant → change barcode → enter PIN + reason
- Adjust inventory: Inventory page → edit quantity → enter reason
- Reset order: Order detail → Reset → enter PIN + reason

**PrintCheatsheetEndOfDay.tsx (spec Section 14.2 #4):**
- Check dashboard: progress meter shows overall completion
- Low inventory: Dashboard → low inventory section
- Problem orders: Dashboard → problem orders section
- Confirm sale closed: Settings → toggle Sale Closed
- Print packets: Sellers page → select seller → Print Packet

**Verify:** `cd web && npm run build`

---

## Interface Contracts

### Provides:
- All 6 print route pages
- PrintLayout, PrintHeader, PrintFooter reusable components
- Print CSS with `.no-print`, `.page-break`
- Markdown cheat sheet equivalents (optional -- create in docs/cheatsheets/)

### Requires (from Sub-Spec 8):
- CRUD pages functional (for navigation context)
- API client for fetching order/seller data

---

## Verification Commands

**Build:** `cd web && npm run build`
**Manual test:**
1. Navigate to `/print/order/:id` → verify layout matches spec
2. Ctrl+P → verify nav hidden, page breaks work, grayscale readable
3. `/print/seller/:id` → verify one customer per page
4. All 4 cheat sheets → verify content complete and prints cleanly
5. Check "Powered by Logic NE" footer on every print page
