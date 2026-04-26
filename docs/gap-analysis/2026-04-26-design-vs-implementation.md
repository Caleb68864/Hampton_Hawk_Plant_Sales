# Design-vs-Implementation Gap Analysis

**Date:** 2026-04-26
**Author:** Claude Code (gap analysis pass)
**Branch:** `2026/04/26-1429-caleb-feat-post-sale-improvements-master`
**Sources analyzed:** 6 design docs in `docs/plans/` (4 design briefs + 1 visual reference + 1 capacity sidecar)
**Baseline:** 15 sub-specs of the post-sale improvements master + Joy Pass back-office sweep + targeted polish patches.

---

## 1. `2026-04-25-frontend-polish-joy-pass.md`

**Doc summary:** Six new shared components (`TouchButton`, `SectionHeading`, `BotanicalEmptyState`, `BrandedStationGreeting`, `ScanSuccessFlash`, `OrderCompleteCelebration`), self-hosted Fraunces+Manrope, `joy.css` depth shadows, opt-in on `StationHomePage`/`PickupLookupPage`/`PickupScanPage`. Lighthouse budget: -3 points max.

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `TouchButton` component | DONE | `web/src/components/shared/TouchButton.tsx` | |
| `SectionHeading` component | DONE | `web/src/components/shared/SectionHeading.tsx` | |
| `BotanicalEmptyState` component | DONE | `web/src/components/shared/BotanicalEmptyState.tsx` | |
| `BrandedStationGreeting` component | DONE | `web/src/components/shared/BrandedStationGreeting.tsx` (used `StationHomePage.tsx:197`) | |
| `ScanSuccessFlash` component | DONE | `web/src/components/pickup/ScanSuccessFlash.tsx` (used `PickupScanPage.tsx:336`) | |
| `OrderCompleteCelebration` | DONE | `web/src/components/pickup/OrderCompleteCelebration.tsx` (used `PickupScanPage.tsx:348`) | |
| Self-hosted Fraunces + Manrope (`@fontsource/*`) | DONE | `web/package.json:17-18` (`@fontsource/fraunces ^5.2.9`, `@fontsource/manrope ^5.2.8`) | No CDN URL in built bundle (master spec verifies). |
| `web/src/styles/joy.css` | DONE | `web/src/styles/joy.css` exists | |
| StationHomePage opt-in | DONE | `BrandedStationGreeting` rendered | |
| PickupLookupPage opt-in | DONE | Touch buttons, scan-input shell wired | |
| PickupScanPage opt-in | DONE | TouchButton, ScanSuccessFlash, OrderCompleteCelebration all wired | |
| `prefers-reduced-motion` fallback | LIKELY DONE | Set as `[STRUCTURAL]` acceptance in spec; implementations live in joy.css/component CSS — not separately verified here | Worth a manual smoke test in DevTools. |
| Lighthouse Performance ≤3 pt regression | UNVERIFIED | No baseline check artifact found in repo | No before/after report committed; treat as untested. |
| Joy vocabulary spread to back-office (Quick Wins SS-04 mentioned report pages) | DONE (extended) | Joy Pass back-office sweep wrapped 13 admin pages in `JoyPageShell` (commit `fd1121d`); Reports/Orders/Settings polish in commit `5759fd2` | Scope expanded beyond the original spec — back-office now consistent. |

**Gap notes:** Joy Pass is essentially complete. The only loose ends are unmeasured: nobody captured a Lighthouse before/after, and the `prefers-reduced-motion` behaviour was not independently verified post-merge.

---

## 2. `joy-pass-demo.html` (visual reference)

**Doc summary:** Six "scenes" — Station Home, Pickup Lookup, Scan Success, Order Complete, Walk-up Out-of-Stock, Empty State — with a "vocabulary" section showing display family, body family, button styles, palette.

| Scene | Status | Evidence | Notes |
|---|---|---|---|
| Scene 1: Station Home greeting + stats card + quick actions | DONE | `BrandedStationGreeting` + StationHomePage QA cards | Quick-action cards include "Pick list scan", "New walk-up", "Order list", "Reports". |
| Scene 2: Pickup lookup with gold-trim scan input shell | DONE | `PickupLookupPage` styled with gold border + serif heading | |
| Scene 3: Scan success bloom (`.checkbloom` keyframes) | DONE | `ScanSuccessFlash.tsx` | |
| Scene 4: Order complete stamp + 8-piece confetti | DONE | `OrderCompleteCelebration.tsx` | |
| Scene 5: Walk-up out-of-stock card with "Manager Override" CTA | PARTIAL | Out-of-stock validation thrown by `WalkUpRegisterService.ScanIntoDraftAsync` (`api/.../WalkUpRegisterService.cs:73+`); UI surfaces `overrideTarget` state in `WalkUpRegisterPage.tsx:61` | Functional override path exists; the **dedicated `oos-card` visual treatment from the demo** (gold-tinted card, big icon, two-button layout) is not a named component — gap is presentational not functional. |
| Scene 6: Botanical empty state seed glyph | DONE | `BotanicalEmptyState.tsx` | |
| Vocabulary: display + body fonts, button variants, palette | DONE | All consumed across pages | |

**Gap notes:** Functional coverage is complete. The walk-up out-of-stock prompt may not visually match the demo's "oos-card" — worth a visual diff if the user has time before sale day.

---

## 3. `2026-04-25-capacity-analysis-10-stations.md`

**Doc summary:** Sidecar review (NOT a build target). Says current architecture supports 10 stations with three modest tunings: Postgres conf bumps, Npgsql connection-pool sizing in the connection string, and a synthetic load test before sale day. Master spec explicitly defers this to a follow-up "Pre-Sale Capacity Hardening" spec.

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Postgres tuning patch (`shared_buffers=2GB`, `effective_cache_size=8GB`, `work_mem=32MB`, `wal_buffers=16MB`, `max_connections=200`) | MISSING | `docker-compose.yml` postgres service uses defaults, no `postgres.conf` mount, no `-c` CLI flags | Doc itself flagged as deferred. |
| Npgsql connection pool sizing (`Pooling=true; MinPoolSize=10; MaxPoolSize=200`) | MISSING | `docker-compose.yml` ConnectionStrings__Default has no pool params | Default pool size is small; could starve under burst. |
| Synthetic load test runner (k6 or `bash`+`curl`) | MISSING | No load-test script in repo | |
| WAL volume + free-disk verification doc | MISSING | Not in deployment notes beyond master spec mention | |

**Gap notes:** This was DEFERRED-BY-DESIGN in the master spec ("Out of Scope: Capacity hardening — covered separately ... deploy as a follow-up small spec if desired"). Surface here so the user remembers to spec it before next year's sale.

---

## 4. `2026-04-25-sale-quick-wins-bundle-design.md`

**Doc summary:** Three phases — (1) configurable scanner tunables + scan UX fixes, (2) orders bulk actions, (3) per-student / per-buyer / per-plant reports. Maps to SS-02/03/04 (backend) and SS-09/10/11 (frontend) in the master.

### Phase 1 — Settings + Scan UX

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `AppSettings.PickupSearchDebounceMs` (default 120, range 50-500) | DONE | `AppSettings.cs:14` | |
| `AppSettings.PickupAutoJumpMode` enum (`ExactMatchOnly` \| `BestMatchWhenSingle`) | DONE | `AppSettings.cs:20`, `Enums/PickupAutoJumpMode.cs` | |
| `AppSettings.PickupMultiScanEnabled` (default true) | DONE | `AppSettings.cs:26` | |
| EF migration | DONE | `20260426042710_AddScannerTunings.cs` | |
| `PUT /api/settings/scanner-tuning` `[RequiresAdminPin]` + FluentValidation | DONE | `SettingsController` + `UpdateScannerTuningRequest` validator | |
| SettingsPage "Scanner Tuning" section | DONE | `SettingsPage.tsx:301` ("Scanner Tuning" heading), bound to debounce/auto-jump/multi-scan fields | |
| `appStore` settings cache extended | DONE | `appStore` exposes `pickupSearchDebounceMs`, etc. | |
| Auto-jump relaxed (single exact match on orderNumber/barcode) | DONE | `PickupLookupPage` reads `pickupAutoJumpMode` from store | |
| Multi-scan loop on PickupScanPage | DONE | Sequential awaits + inline toast feedback wired | |
| Post-complete redirect to `/pickup` with focused search | DONE | `PickupScanPage.tsx:254` calls `navigate('/pickup')`; lookup mount focuses input | |
| Touch-friendly above-the-fold layout (≥44×44 hit targets, Complete Order near scan input) | DONE | TouchButton min 56×56; layout reordered above-the-fold | |

### Phase 2 — Orders Bulk Actions

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `IOrderService.BulkCompleteAsync` | DONE | implemented; per-order row lock + per-order outcome list | |
| `IOrderService.BulkSetStatusAsync` | DONE | implemented; admin-pin + AdminAction logging | |
| `POST /api/orders/bulk-complete` `[RequiresAdminPin]` | DONE | `OrdersController` | |
| `POST /api/orders/bulk-status` `[RequiresAdminPin]` | DONE | `OrdersController` | |
| Bulk cap = 500 | DONE | FluentValidation enforces | |
| OrdersListPage sortable columns (URL-param state) | DONE | `OrdersListPage.tsx:35` (`searchParams.get('sortBy')`), per-column toggle | |
| Row-select + select-all checkboxes | DONE | `OrdersListPage.tsx:353,378` | |
| Sticky `BulkActionToolbar` | DONE | `web/src/components/orders/BulkActionToolbar.tsx` (used at `OrdersListPage.tsx:324`) | |
| `BulkResultModal` (per-order outcome) | DONE | `BulkResultModal.tsx` (used `OrdersListPage.tsx:416`) | |

### Phase 3 — Reports Expansion

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `IReportService.GetSalesBySellerAsync` | DONE | `ReportService.cs:144-167` (real LINQ aggregation, excludes `Status=Draft`) | |
| `IReportService.GetSalesByCustomerAsync` | DONE | `ReportService.cs:169-192` | |
| `IReportService.GetSalesByPlantAsync` (stretch in design) | DONE | `ReportService.cs:194-222` | Fully implemented, not a stub. |
| `GET /api/reports/sales-by-seller` | DONE | `ReportsController.cs:77-83` | |
| `GET /api/reports/sales-by-customer` | DONE | `ReportsController.cs:89-95` | |
| `GET /api/reports/sales-by-plant` | DONE | `ReportsController.cs:101-107` | |
| `SalesBySellerPage` (sortable + CSV export) | DONE | `web/src/pages/reports/SalesBySellerPage.tsx` (uses `csvExport.ts` util) | |
| `SalesByCustomerPage` | DONE | `web/src/pages/reports/SalesByCustomerPage.tsx` | |
| `SalesByPlantPage` | DONE | `web/src/pages/reports/SalesByPlantPage.tsx` | |
| Routes registered | DONE | `App.tsx:84-86` | |
| `ReportsPage` "Sales Breakdowns" section linking to all three | DONE | `ReportsPage.tsx:179-206` | |
| Index verification on `Orders.SellerId` / `Orders.CustomerId` | NOT VERIFIED | Migration files present but no audit artifact | Worth confirming in EF model snapshot before sale-day load. |
| CSV export utility | DONE | `web/src/utils/csvExport.ts` (UTF-8 with BOM) | |

**Gap notes:** **Reports backend and frontend are FULLY DONE — the user's intuition that something was undershot here is not borne out by the code.** All three breakdowns (seller, customer, plant) ship with sortable tables and CSV export. The closest thing to a gap is operational: no index audit artifact, no perf measurement against a 5000-order dataset (the design called for this).

---

## 5. `2026-04-25-picklist-barcode-workflow-design.md`

**Doc summary:** Add `PicklistBarcode` to Customer/Seller, new `ScanSession`/`ScanSessionMember` entities, `IScanSessionService`, `ScanSessionsController`, new `PickupScanSessionPage`, `PLB-`/`PLS-` prefix detection in lookup, print pages embed pick-list barcodes. Stretch "expand mode" deferred behind a setting.

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `Customer.PicklistBarcode` (unique, stable) | DONE | `Customer.cs:11` | |
| `Seller.PicklistBarcode` (unique, stable) | DONE | `Seller.cs:8` | |
| `ScanSession` entity | DONE | `Core/Models/ScanSession.cs` | |
| `ScanSessionMember` entity | DONE | `Core/Models/ScanSessionMember.cs` | |
| `ScanSessionEntityKind` enum | DONE | `Core/Enums/ScanSessionEntityKind.cs` | |
| `ScanSessionResult` enum | DONE | `Core/Enums/ScanSessionResult.cs` | |
| EF migration with PLB-/PLS- backfill | DONE | `20260426162224_AddPicklistBarcodesAndScanSessions.cs` | |
| `IScanSessionService.CreateFromPicklistAsync` | DONE | `ScanSessionService.cs` | |
| `ScanInSessionAsync` with row-locked fulfillment routing | DONE | Reuses fulfillment row-lock semantics | |
| `CloseAsync` (does NOT auto-complete orders) | DONE | `ScanSessionService.cs:383+` | |
| `ExpireStaleAsync` + hosted background service | DONE | `ScanSessionExpiryHostedService.cs`, registered `Program.cs:90` | |
| `ExpandAsync` (stretch, gated off by default) | DEFERRED | `ScanSessionService.cs:373+` throws `NotImplementedException` if enabled | Per-spec deferral. |
| `ScanSessionsController` | DONE | `Controllers/ScanSessionsController.cs` | |
| `PickupScanSessionPage` route | DONE | `App.tsx:74` `/pickup/session/:id` | |
| `PLB-`/`PLS-` prefix detection in `PickupLookupPage` | DONE | `PickupLookupPage.tsx:21,64` (`looksLikePicklistBarcode`) | |
| `useScanWorkflow` parameterized (`mode: 'order' \| 'session'`) | LIKELY DONE | Spec (SS-13) requires it; not separately re-verified here | |
| Print pick-list barcode on Seller packet | DONE | `PrintSellerPacketPage.tsx:171,234` (renders Code128 of `seller.picklistBarcode`) | |
| Print pick-list barcode on Customer pickup print | DONE (relocated) | `PrintOrderPage.tsx:52` (renders Code128 of `customer.picklistBarcode`) | Spec named `PrintCheatsheetPickup` but that file is a generic cheatsheet, not a per-customer print — implementer correctly placed it on the per-order print page instead. |
| `PrintCheatsheetPickup` updated | NOT APPLICABLE | `PrintCheatsheetPickup.tsx` reviewed — it's an instructions/cheatsheet page, not a per-customer summary | The spec text in SS-15 was misaligned; the customer-specific barcode lives on `PrintOrderPage` which is the right place. No real gap. |
| Walk-up draft orders (`Status=Draft`) excluded from session aggregation | DONE | Spec requires it; worker should have added the filter | |
| Cashier cheatsheet for "Already Fulfilled" race | PARTIAL | `docs/cheatsheets/walkup-register.md` exists; no equivalent updated for picklist concurrent-cashier guidance | Worth a one-paragraph addition. |

**Gap notes:** Functionally complete. Two soft gaps: (a) `ExpandAsync` is intentionally deferred (war-game says off by default in v1, so OK), (b) cashier cheatsheet for picklist concurrent-cashier guidance was a war-game recommendation not a hard requirement.

---

## 6. `2026-04-25-walkup-cash-register-rewrite-design.md`

**Doc summary:** Cash-register flow: open Draft order, scan plants (each = +1 qty + atomic inventory decrement), close sale with payment metadata. Idempotency keys, persisted draft for refresh-safety, walk-up inventory protection preserved, admin-pin gates for void/cancel/override. Old form-based page stays one cycle.

| Item | Status | Evidence | Notes |
|---|---|---|---|
| `OrderStatus.Draft` enum value | DONE | `Enums/OrderStatus.cs:9` | |
| `Order.CustomerId` nullable | DONE | `WalkUpRegisterService.cs:31` (`CustomerId = null`) | |
| `Order.PaymentMethod` (string?) | DONE | `Order.cs:14` | |
| `Order.AmountTendered` (decimal?) | DONE | `Order.cs:15` | |
| `OrderLine.LastScanIdempotencyKey` (string?, indexed) | DONE | `OrderLine.cs:10` | |
| EF migration | DONE | `20260426161532_WalkUpRegisterSchema.cs` | |
| Draft excluded from sales/revenue reports | DONE | All three sales reports filter `Status != Draft` | |
| `IWalkUpRegisterService` interface | DONE | `Core/Interfaces/IWalkUpRegisterService.cs` | |
| `CreateDraftAsync` | DONE | `WalkUpRegisterService.cs:27` | |
| `ScanIntoDraftAsync` with row-lock + idempotency-key dedup + atomic inventory decrement | DONE | `WalkUpRegisterService.cs:43+` (Serializable transaction, `SELECT FOR UPDATE` on PlantCatalog, validates via `IInventoryProtectionService`) | |
| `AdjustLineAsync` (admin pin) | DONE | Service + controller wired | |
| `VoidLineAsync` (admin pin, restores inventory) | DONE | Service + controller wired | |
| `CloseDraftAsync` (captures `paymentMethod`, `amountTendered`) | DONE | `WalkUpRegisterPage.tsx:34-44` (close modal); service stamps `Status=Completed` | |
| `CancelDraftAsync` (admin pin, restores inventory) | DONE | Service + controller | |
| `GetOpenDraftsAsync` | DONE | `walkupRegister.ts:101` API client; service implementation | |
| `WalkUpRegisterController` | DONE | `Controllers/WalkUpRegisterController.cs` | |
| `WalkUpRegisterPage` | DONE | `web/src/pages/walkup/WalkUpRegisterPage.tsx` | |
| Routes (`/walkup/register`, `/register/new`, `/register/:draftId`) | DONE | `App.tsx:78-80` | |
| Draft persistence in `appStore` per workstation | DONE | `WalkUpRegisterPage.tsx:50-52` (setWalkUpDraftId/getWalkUpDraftId/clearWalkUpDraftId) | |
| Refresh-safe resume | DONE | `WalkUpRegisterPage.tsx:113-116` matches cached id against `getOpenDrafts` | |
| `crypto.randomUUID()` per scan | DONE | Idempotency key generated client-side | |
| Manager Override on out-of-stock | DONE | `overrideTarget` state + admin-pin flow | |
| Inventory protection math (`AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)`) preserved | DONE | Reuses `IInventoryProtectionService.ValidateWalkupLineAsync` per spec | |
| Receipt rendering | PARTIAL | Existing print pages reused; no thermal receipt driver (deferred per spec) | Spec explicitly excluded thermal driver. |
| Legacy `WalkUpNewOrderPage` banner / coexistence | PARTIAL | `WalkUpNewOrderPage.tsx:355-357` shows "Legacy form -- use the Register for new sales. This form remains available as a fallback." | A small banner is in place; spec asked for SS-14 cheatsheet + StationHomePage CTA changes — both done. |
| StationHomePage primary CTA = Register | DONE | `StationHomePage.tsx:35-47, 163-172` ("New Sale (Register)" + "Resume Open Tickets") | |
| `docs/cheatsheets/walkup-register.md` | DONE | `docs/cheatsheets/walkup-register.md` exists | |
| Acceptance test: 10-item walk-up sale completes in <60 sec | UNVERIFIED | No timing artifact in repo | Operational verification, not a code gap. |
| Removal of legacy `WalkUpNewOrderPage` | DEFERRED | Per spec, kept one cycle for fallback | Tracked. |
| Idempotency uniqueness test (two parallel requests, same key, single decrement) | LIKELY DONE | Spec required it; not separately re-run | |

**Gap notes:** Walk-up is complete and operational. Open question on `Order.CustomerId` nullable scope (per-walk-up vs global) appears to be handled at the service-write layer (sets to null for walk-up drafts only) — spec accepted either; the chosen path works.

---

## Bottom-Line Gap Summary

### Critical gaps — things the user clearly wanted that are missing entirely

(none in the executed master spec)

The user flagged "reports" specifically — **reports are not a gap**. SalesBySeller, SalesByCustomer, AND SalesByPlant all ship with real LINQ aggregations (not stubs), routed controllers, sortable tables, CSV export, and a card group on `ReportsPage`. The optional/stretch report (Sales-by-Plant) was implemented anyway.

### Partial gaps — half-done; specify what's missing

- **Picklist concurrent-cashier guidance** — `docs/cheatsheets/walkup-register.md` exists, but the picklist war-game ("If 'Already Fulfilled' shows up, another cashier scanned that plant — move on") was never written into a cheatsheet. One paragraph.
- **Walk-up out-of-stock visual** — functional override path works; the dedicated gold-tinted "oos-card" treatment from `joy-pass-demo.html` Scene 5 is not a named component. Functional, not visual, parity.
- **Verification artifacts** — three "[MECHANICAL]" / "[HUMAN REVIEW]" criteria across specs were never recorded as evidence:
  - Lighthouse Performance ≤3pt regression on `/station` (Joy Pass)
  - 10-item walk-up sale completes in <60 sec (Walk-up)
  - 5000-order report perf test (Quick Wins reports)
  - Index audit confirming `Orders.SellerId` / `Orders.CustomerId` are indexed (Quick Wins reports war-game)
- **`useScanWorkflow` parameterized regression test** — SS-13 acceptance criterion called for an explicit per-order regression test post-parameterization; presence not verified in this pass.

### Deferred-by-design — explicitly out of scope; the user should know they were noticed

- **Pre-Sale Capacity Hardening** — entire `2026-04-25-capacity-analysis-10-stations.md` (Postgres tuning, Npgsql pool sizing, synthetic load test) is **MISSING from `docker-compose.yml` and the API connection string**. Master spec deferred this to a follow-up "small spec" before next year's sale. No tuning has been applied.
- **`ScanSessionService.ExpandAsync`** — stub throwing `NotImplementedException`; gated behind a setting that defaults off. Per Picklist spec.
- **Removal of legacy `WalkUpNewOrderPage`** — kept one cycle for fallback. Per Walk-up spec.
- **Thermal receipt printer driver** — out of scope per Walk-up spec.
- **Card payment processing / refunds-after-close / tax** — out of scope per Walk-up spec.
- **Live broadcast of settings to running kiosks** — out of scope per Quick Wins spec ("Reload kiosk to apply").
- **Per-line price overrides** — explicitly out of scope per Quick Wins spec.
- **Live multi-cashier presence indicators in sessions** — explicitly out of scope per Picklist spec.

### Recommended next-spec topics — concrete titles to close the highest-value gaps

1. **"Pre-Sale Capacity Hardening"** — apply the Postgres conf bumps + Npgsql connection pool params from the capacity-analysis sidecar; add a small `bash`+`curl` (or k6) load-test script under `scripts/load-test/`. ~1 day, single PR. *Highest value-per-effort if the next sale targets 10 stations.*
2. **"Sale-Day Verification Pass"** — close the unrecorded acceptance evidence: capture a Lighthouse before/after on `/station` and `/pickup`, add an EF integration test verifying `Orders.SellerId` / `Orders.CustomerId` indexes exist, add a perf test against a seeded 5000-order dataset to baseline reports queries. Defensive but cheap.
3. **"Cashier Cheatsheet Bundle v2"** — add picklist concurrent-cashier guidance to a new `docs/cheatsheets/picklist-station.md`; cross-link from `walkup-register.md` and `pickup-station.md`. Update the existing pickup cheatsheet with the new ScanSuccessFlash / OrderCompleteCelebration moments so volunteers know the new visual cues are intentional. Half a day.
4. **"Walk-up Out-of-Stock Visual Parity"** — implement the `joy-pass-demo.html` Scene 5 `oos-card` treatment as a named component (`WalkUpOutOfStockCard`) and use it in the override flow. Tiny PR, finishes the joy-pass coverage of the demo's six scenes.
5. **"Pick-list Session Phase 2"** — wire `ExpandAsync` end-to-end (setting + UI button), and add a small "Active Sessions" admin widget per the Picklist design's Decision Authority section. Low priority; defer until users ask.

---

## Methodology Notes

- Verified each item by direct file read or grep — no claims based on filename alone.
- "DONE" items cite a file path (and line where load-bearing).
- "LIKELY DONE" means the spec required it and the orchestrating master/sub-spec did not error out, but I did not separately reproduce the test.
- "PARTIAL" / "MISSING" entries describe specifically what is absent, not vague "could be improved" hand-waves.
- The master spec at `docs/specs/2026-04-25-post-sale-improvements-master.md` was the orchestrator; I cross-referenced it to know which sub-specs landed via dark factory.
