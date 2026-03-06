# Hampton Hawks Plant Sales -- Barcode Order Lookup for Pickup Kiosk

## Meta

| Field | Value |
|-------|-------|
| Client | Personal / School Fundraiser |
| Project | Hampton Hawks Plant Sales |
| Repo | Hampton_Hawk_Plant_Sales |
| Date | 2026-03-06 |
| Author | Codex |
| Quality | 28/30 |
| Outcome Clarity | 5 |
| Scope Boundaries | 5 |
| Decision Guidance | 4 |
| Edge Coverage | 4 |
| Acceptance Criteria | 5 |
| Decomposition | 5 |

## Outcome

Add a scanner-first order lookup flow so volunteers can scan a barcode printed on the customer order sheet and land in the correct pickup order with little or no typing. Done means the printed order sheet includes a real scanner-readable barcode for the order number, the pickup lookup screen can submit keyboard-wedge scans immediately, and volunteers get clear success or recovery feedback for exact-match, no-match, and duplicate-match cases.

## Intent

### Trade-off Hierarchy

1. Reliable scanner readability over lightweight custom barcode rendering.
2. Fast exact-order retrieval over preserving the current browse-first lookup flow.
3. Additive changes to existing pickup and print routes over introducing a parallel kiosk workflow.
4. Operator focus recovery and repeat-scan speed over extra confirmation steps.
5. Explicit safe fallbacks for no-match and duplicate-match cases over aggressive auto-navigation when results are ambiguous.

### Decision Boundaries

- Prefer a real barcode symbology and renderer already proven for print output, even if it adds a small dependency.
- Prefer exact order-number handling on the pickup lookup page over broad fuzzy matching when the input looks like a scanner payload.
- Prefer reusing existing `/pickup` and `/pickup/:orderId` routes over creating a second pickup station route.
- Stop and ask only if requirements expand into camera-based scanning, QR codes, server-side PDF generation, or a mandatory backend schema change for order lookup.

## Context

This spec is grounded in the current codebase and the existing kiosk-mode work already in the repo.

### Relevant Existing Surfaces

- `web/src/pages/print/PrintOrderPage.tsx` renders the customer order sheet and already shows the human-readable order number in the print header.
- `web/src/components/print/PrintHeader.tsx` owns the top-of-sheet order details area where the new order barcode should live.
- `web/src/pages/pickup/PickupLookupPage.tsx` already searches by customer, pickup code, and order number, but today it stays browse-oriented and requires the operator to click into the order.
- `web/src/components/shared/SearchBar.tsx` debounces input by default and does not expose scanner-oriented autofocus, Enter-submit, or idle-submit behavior.
- `web/src/components/pickup/ScanInput.tsx` already demonstrates the focus/refocus pattern the pickup station uses successfully for keyboard-wedge scanners.
- `web/src/pages/lookupprint/LookupPrintStationPage.tsx` already provides a station-safe print workflow, so the order-sheet barcode can be reprinted without broad admin navigation.

### Audit Findings That Shape This Plan

- The current barcode rendering in `web/src/pages/print/PrintPlantLabelsPage.tsx` is a visual placeholder, not a standards-based barcode implementation volunteers should depend on for scanner-critical order sheets.
- The current pickup lookup search does not auto-open an exact order-number match, which means a scanned order number still leaves a click in the workflow.
- The current shared search box waits on a debounce and does not distinguish fast scanner bursts from slower human typing.
- Existing kiosk work already prioritizes route safety and refocus behavior, so this feature should fit that station model instead of bypassing it.

## Requirements

1. Every printable customer order sheet must include the human-readable order number and a scanner-readable barcode encoding that same order number.
2. The barcode must be placed near the top order-details area so a volunteer can scan the sheet without awkward repositioning.
3. The barcode format must work with common USB keyboard-wedge scanners and must be generated reliably in the client print view.
4. The pickup lookup screen must keep scanner input focused when the station is idle and after safe recovery actions.
5. Scanning a printed order-sheet barcode into the pickup lookup screen must search by order number.
6. If the scanner sends Enter, the lookup must submit immediately.
7. If the scanner does not send Enter, the app must still support fast auto-submit once a valid scanner-like order number input is detected.
8. If exactly one order matches the scanned order number, the app must open that order directly in the pickup scan workflow.
9. If no order matches, the volunteer must see a clear station-safe error message and be able to clear and rescan quickly.
10. If multiple orders match, the screen must present a clear duplicate-results list and avoid auto-opening the wrong order.
11. The station must visibly confirm what order number was scanned or submitted so volunteers can recover from bad scans.
12. After a lookup completes or is cleared, the workflow must support rapid repeated use for the next customer without extra navigation.

## Sub-Specs

### 1. Printable Order Barcode Surface

**Scope:** Add a real scanner-readable order-number barcode to printed order sheets and keep the top-of-sheet layout readable in browser print preview.

**Files:**
- `web/package.json`
- `web/src/components/print/PrintHeader.tsx`
- `web/src/components/print/OrderNumberBarcode.tsx` (new)
- `web/src/pages/print/PrintOrderPage.tsx`
- `docs/tests/2026-03-06-barcode-order-lookup/UI-01-print-order-sheet-barcode.md` (new)

**Acceptance Criteria:**
1. `[STRUCTURAL]` A dedicated print barcode component exists for order-number rendering instead of reusing the faux label barcode implementation from plant labels.
2. `[STRUCTURAL]` The implementation uses a real linear barcode format suitable for keyboard-wedge scanners, with `Code 128` as the default unless a better-supported equivalent is proven in print testing.
3. `[BEHAVIORAL]` The printed order sheet shows the order number as plain text and as a barcode encoding the same value.
4. `[BEHAVIORAL]` In print preview and on paper, the barcode remains near the top order-details area and does not overlap other header fields or collapse on narrow printer margins.
5. `[HUMAN REVIEW]` A volunteer using a common USB scanner can scan the printed order sheet from a normal counter position without repeated read failures caused by layout, scaling, or insufficient quiet zone.
6. `[MECHANICAL]` `npm run build` passes after the barcode dependency and print component changes.

**Dependencies:** none

---

### 2. Scanner-First Pickup Lookup Submission

**Scope:** Upgrade the pickup lookup entry field so it behaves like a scanner target first and a typed search box second, including autofocus, Enter-submit, idle-submit fallback, and exact-match auto-open.

**Files:**
- `web/src/pages/pickup/PickupLookupPage.tsx`
- `web/src/components/shared/SearchBar.tsx`
- `web/src/components/pickup/OrderLookupInput.tsx` (new, if cleaner than extending `SearchBar`)
- `web/src/api/orders.ts`
- `web/src/utils/orderLookup.ts` (new, if shared normalization/exact-match logic is extracted)
- `web/src/pages/pickup/orderLookup.test.ts` (new)

**Acceptance Criteria:**
1. `[STRUCTURAL]` The pickup lookup screen uses an input implementation that can explicitly support autofocus, imperative refocus, Enter-submit, clear/reset, and scanner-like idle-submit behavior.
2. `[BEHAVIORAL]` When the pickup lookup page loads in normal or kiosk mode, the lookup field is focused unless a modal or browser dialog intentionally takes focus away.
3. `[BEHAVIORAL]` A scanner payload followed by Enter submits immediately with no extra click.
4. `[BEHAVIORAL]` A scanner payload without Enter still submits automatically after a short settle window, but normal human typing is not forced into premature lookup while the operator is still entering text.
5. `[BEHAVIORAL]` When the normalized input exactly matches one order number, the app navigates directly to `/pickup/:orderId`.
6. `[BEHAVIORAL]` When the input is cleared or the operator returns from a no-match state, focus returns to the lookup field so the next sheet can be scanned immediately.
7. `[MECHANICAL]` Unit coverage exists for normalization and submission behavior, including Enter-submit, no-Enter auto-submit, and exact-match detection.

**Dependencies:** sub-spec 1

---

### 3. Error Handling, Duplicate Resolution, and Repeat-Use Ergonomics

**Scope:** Make the pickup station resilient under live event use by adding clear no-match messaging, duplicate-match handling, visible scanned-value confirmation, and documented recovery behavior for repeated scans.

**Files:**
- `web/src/pages/pickup/PickupLookupPage.tsx`
- `web/src/pages/pickup/PickupScanPage.tsx`
- `web/src/utils/errorMessaging.ts`
- `web/src/pages/print/PrintCheatsheetPickup.tsx`
- `docs/tests/2026-03-06-barcode-order-lookup/test-plan.md` (new)
- `docs/tests/2026-03-06-barcode-order-lookup/UI-02-pickup-order-barcode-lookup.md` (new)
- `docs/tests/2026-03-06-barcode-order-lookup/UI-03-pickup-order-barcode-recovery.md` (new)

**Acceptance Criteria:**
1. `[BEHAVIORAL]` If a scanned order number yields no result, the station shows a clear error such as `No order found for scanned barcode/order number.` and keeps the volunteer inside `/pickup`.
2. `[BEHAVIORAL]` If multiple orders match the scanned value, the station shows a focused list of matching orders with enough detail to choose safely, and it does not auto-open any one result.
3. `[BEHAVIORAL]` The station visibly confirms the last scanned or submitted order number so the operator can tell whether the scanner read the sheet correctly.
4. `[BEHAVIORAL]` A simple clear action resets the current lookup state and returns focus to the scanner input for the next order.
5. `[BEHAVIORAL]` Returning from the pickup scan page to lookup keeps the station ready for the next scan without routing the operator to unrelated screens.
6. `[STRUCTURAL]` Pickup cheat-sheet copy and manual verification docs include barcode-based order lookup steps, expected success behavior, and recovery steps for bad scans.
7. `[HUMAN REVIEW]` In a live counter simulation, a volunteer can scan one printed sheet, act on the returned order, clear or return, and scan the next sheet without touching the mouse except when duplicate results require a choice.

**Dependencies:** sub-spec 2

## Edge Cases

1. **Scanner sends Enter after every read**  
   Treat Enter as the primary fast path and submit immediately.

2. **Scanner does not send Enter**  
   Use a short idle-submit fallback only when the input looks like a completed scanner payload, not mid-typing human input.

3. **Whitespace or prefix/suffix characters from scanner configuration**  
   Normalize the scanned value before exact matching, but preserve the visible raw or normalized order number in operator feedback.

4. **No exact match but fuzzy search would have partial matches**  
   Do not auto-open a fuzzy result for a scanned order number; show the safe no-match state and let the operator retry or choose manually.

5. **Duplicate order-number matches due to bad data or imports**  
   Show the duplicate list with customer and status details and require an explicit choice.

6. **Focus lost after print preview, browser alert, or accidental click**  
   The station should restore focus to the lookup input on return to the pickup lookup screen.

7. **Printer scaling shrinks the barcode**  
   The manual verification plan must include print-preview and paper checks so scanner reliability is validated at actual output size.

8. **Repeated scans of the same sheet**  
   The lookup page should not trap the station in stale error state; clear/reset must be one action and the next scan must work immediately.

## Out of Scope

- Camera-based scanning through a phone or tablet camera.
- QR codes or multi-field barcodes encoding anything beyond the order number.
- Replacing plant-label barcode behavior across the rest of the system.
- Reworking the backend order schema or import format solely for this feature unless exact order lookup proves impossible without it.
- Building a new pickup route separate from the current `/pickup` and `/pickup/:orderId` flow.

## Constraints

### Musts

- Use a scanner-readable linear barcode format for printed order sheets.
- Keep the human-readable order number visible on the printed sheet.
- Search scanned values by order number first.
- Auto-open only on a single exact order match.
- Keep volunteers inside the pickup station workflow for success and recovery paths.

### Must-Nots

- Do not rely on the current faux `BarcodeSvg` approach from plant labels for scanner-critical order sheets.
- Do not auto-open a fuzzy or ambiguous order result from a scanned value.
- Do not require volunteers to use the mouse for the happy-path single-match lookup.
- Do not send no-match recovery through `/orders`, `/station`, or unrelated admin pages.

### Preferences

- Prefer `Code 128` rendered to SVG with a mature library such as `JsBarcode`.
- Prefer a dedicated scanner-capable pickup lookup input over adding brittle scanner heuristics to the generic shared search bar if the shared component becomes hard to reason about.
- Prefer frontend-only exact-match logic built on the existing orders list endpoint if it remains reliable and testable.
- Prefer visible station copy like `Scan order sheet barcode` and `Ready for next order` over generic search wording.

### Escalation Triggers

- The team wants the barcode to encode more than the order number.
- Real print testing shows browser-rendered barcodes are unreliable and server-generated PDFs become necessary.
- Existing order search cannot support safe exact-match and duplicate handling without a new backend endpoint.
- The feature expands from pickup station only to a cross-station scanner standard that must also cover lookup/print, admin, or offsite workflows in the same release.

## Verification

1. Open an order sheet at `/print/order/:orderId` and verify the order number appears both as plain text and as a barcode near the top header area.
2. Print a sample order sheet on the paper and printer combination the event will use. Scan the printed barcode into a plain text field and confirm the scanner outputs the expected order number.
3. Open `/pickup` and confirm the lookup field is already focused.
4. Scan a printed order sheet with a scanner that sends Enter. Confirm the app navigates directly to the matching `/pickup/:orderId` screen when there is one exact match.
5. Repeat with a scanner profile that does not append Enter. Confirm the app still submits after the idle-settle fallback and opens the same order.
6. Scan or enter an unknown order number. Confirm the station stays on `/pickup`, shows `No order found for scanned barcode/order number.`, and lets the volunteer clear and rescan without clicking elsewhere.
7. Create or simulate duplicate order-number matches. Confirm the station shows a choice list instead of auto-opening a result.
8. Return from the order scan screen to lookup and confirm the pickup station is immediately ready for the next scanned sheet.
9. Run `cd web && npm run build` and the added unit tests covering lookup normalization and submit behavior.
