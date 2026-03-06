---
type: phase-spec
sub_spec: 3
title: "Station-Specific Pickup and Lookup/Print Experiences"
master_spec: "docs/specs/2026-03-06-kiosk-mode-station-profiles.md"
dependencies: [2]
---

# Sub-Spec 3: Station-Specific Pickup and Lookup/Print Experiences

## Shared Context

See [master spec](../2026-03-06-kiosk-mode-station-profiles.md).

This is the volunteer-facing phase. Sub-specs 1 and 2 make kiosk mode possible; this phase makes the two supported station profiles actually usable by people with little or no training.

The live audit identified the main UX risks to solve here:
- `PickupScanPage` shows `Back to Lookup` but currently sends the user to `/station`, which is misleading.
- `OrdersListPage` is too broad to serve as a volunteer-safe invoice-handoff page.
- `WalkUpNewOrderPage` crashes on direct load, so no kiosk recovery path should route volunteers there.
- Existing print pages already work, which means kiosk printing should preserve station context rather than rebuild print flows.

## Codebase Analysis

### Existing Files

- `web/src/pages/pickup/PickupLookupPage.tsx` already supports A-Z filtering, search, and order navigation.
- `web/src/pages/pickup/PickupScanPage.tsx` already has strong scan UX, but one back-navigation label is wrong for kiosk usage.
- `web/src/components/shared/BackToStationHomeButton.tsx` always returns to `/station` and is not reusable for profile-specific destinations yet.
- `web/src/pages/orders/OrdersListPage.tsx` mixes search, filters, selection, and admin-style printing controls; it is not appropriate as a locked lookup station.
- `web/src/pages/print/PrintOrderPage.tsx` and `PrintSellerPacketPage.tsx` already render well through `PrintLayout`.
- `web/src/pages/DocsPage.tsx` and `docs/cheatsheets/*.md` already hold volunteer guidance and are natural places to explain kiosk mode.

### Patterns To Follow

- Station workflows already use focused top-of-page headings and large primary actions.
- Print flows already open in separate tabs/windows from operational screens.
- Volunteer help content is embedded as sectioned cards, not long prose documents.
- Search-heavy pages use existing shared components such as `SearchBar`, `StatusChip`, and `LoadingSpinner`.

### Test Location

- Frontend helper tests for search ranking or route-return helpers: `web/src/pages/lookupprint/*.test.ts` or `web/src/utils/*.test.ts`
- Manual scenario docs: `docs/tests/2026-03-06-kiosk-mode/`

### Interfaces This Phase Must Provide

- A dedicated `Lookup & Print` station page that only exposes safe volunteer actions.
- Profile-appropriate back-navigation on pickup and print flows.
- Updated docs and cheat sheets that match the kiosk terminology shown in the UI.

## Implementation Steps

### Step 1: Create station-safe search helpers for Lookup & Print

**Test first**
- Create `web/src/pages/lookupprint/lookupPrintSearch.test.ts` covering:
  - ranking exact order number or pickup code matches above fuzzy customer matches
  - grouping results into orders and optional seller packet actions
  - no-match behavior that never suggests `/walkup/new`

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/pages/lookupprint/lookupPrintSearch.test.ts
```

**Implement**
- Create `web/src/pages/lookupprint/lookupPrintSearch.ts` or similar pure helper module.
- Reuse existing API patterns from `PickupLookupPage` and `OrdersListPage`, but keep the station page logic focused on search-and-print outcomes.
- Define a result model that can power buttons such as:
  - `Print Order Sheet`
  - `Print Seller Packet` when `sellerId` exists
  - `Open Pickup` only if the team explicitly wants that action exposed in this station

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/pages/lookupprint/lookupPrintSearch.test.ts
```

**Commit**
- `feat: add lookup print search helpers`

---

### Step 2: Build the dedicated Lookup & Print station page

**Test first**
- Add a focused helper test for any extracted page-state reducer or result-shaping logic.

**Implement**
- Create `web/src/pages/lookupprint/LookupPrintStationPage.tsx`.
- The page should include:
  - a clear station heading
  - one search field for customer name, order number, or pickup code
  - search results optimized for printing, not editing
  - per-result print actions that open print views in a new tab/window
  - safe empty/error states with retry guidance
- Keep the page intentionally narrow. Do not include:
  - create order
  - edit order
  - import
  - settings
  - reports
  - global management controls

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Manual acceptance check**
1. Load the page directly.
2. Search by pickup code and confirm the matching order appears first.
3. Print an order sheet and confirm the station page remains open in the original tab.
4. Search for a seller-backed order and confirm seller packet printing is available when relevant.

**Commit**
- `feat: add dedicated lookup and print station page`

---

### Step 3: Wire the new station route and kiosk landing behavior

**Test first**
- Extend `web/src/routes/kioskRouteConfig.test.ts` if sub-spec 2 needs a new allowlisted route.

**Implement**
- Register the new station page in `web/src/App.tsx` with a stable route such as `/station/lookup-print` or `/lookup-print`.
- Update `kioskRouteConfig.ts` from sub-spec 2 so the `lookup-print` profile lands on the new page and only that page plus its print routes are allowed.
- If `StationHomePage` remains visible outside kiosk mode, update its `Lookup & Print` card to navigate to the new dedicated page instead of `/orders`.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `feat: route lookup print profile to dedicated station page`

---

### Step 4: Fix pickup back-navigation and make station buttons reusable

**Test first**
- Add a small helper test if you extract reusable destination logic for station buttons.

**Implement**
- Update `web/src/pages/pickup/PickupScanPage.tsx` so the visible `Back to Lookup` action navigates to `/pickup`, not `/station`.
- Update `web/src/components/shared/BackToStationHomeButton.tsx` to accept optional props such as:
  - `to`
  - `label`
- Keep `/station` as the default for normal app mode, but allow kiosk pages to point back to their profile landing page.
- Review `PickupLookupPage.tsx`, `SettingsPage.tsx`, and any other station-adjacent pages that use `BackToStationHomeButton` so labels still make sense in kiosk mode.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `fix: correct pickup lookup navigation for kiosk workflows`

---

### Step 5: Make print routes kiosk-aware without changing the print layouts fundamentally

**Test first**
- Add pure helper coverage if you introduce a `returnTo` query helper for print flows.

**Implement**
- Update the station pages to open print views in a new tab/window so the originating kiosk screen stays open.
- Update `web/src/pages/print/PrintOrderPage.tsx` and `PrintSellerPacketPage.tsx` to accept an optional `returnTo` query parameter for their back link, defaulting to existing behavior when absent.
- Use kiosk-aware `returnTo` values when launching print pages from a station profile.
- Do not make print pages themselves depend on kiosk-only global state.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Manual acceptance check**
1. From `Pickup` kiosk, print an order-related page if that workflow exposes one.
2. From `Lookup & Print` kiosk, print both an order sheet and a seller packet when data permits.
3. Close print preview or the print tab and confirm the original station tab is unchanged.
4. Click `Back` on the print page and confirm it returns to the kiosk-safe station route when `returnTo` is present.

**Commit**
- `feat: preserve kiosk context across print flows`

---

### Step 6: Update volunteer docs and cheat sheets for kiosk mode

**Test first**
- No meaningful automated test is needed; treat this as documentation verification plus build.

**Implement**
- Update `web/src/pages/DocsPage.tsx` with kiosk-oriented language and a new section that explains:
  - what kiosk mode is
  - how pickup and lookup/print stations differ
  - how an admin unlocks the station
- Update `docs/cheatsheets/pickup-station.md` and `docs/cheatsheets/lookup-and-print.md` so the printed instructions match the new station route names and button labels.
- If the printable cheat sheet React pages need copy changes, update them too so the in-app and printed docs stay aligned.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `docs: add kiosk mode guidance for station volunteers`

---

### Step 7: Add a manual verification pack for kiosk mode

**Test first**
- N/A. This step creates the reproducible manual checks for the event floor.

**Implement**
- Create `docs/tests/2026-03-06-kiosk-mode/test-plan.md`.
- Add focused scenario files if helpful, for example:
  - `UI-01-pickup-kiosk-lockdown.md`
  - `UI-02-lookup-print-kiosk.md`
  - `UI-03-kiosk-print-return.md`
- Include exact setup, click paths, and expected outcomes so future audits or `/forge-test-create` work can reuse them.

**Verify**
- Review the test plan against the master spec verification checklist and make sure each kiosk requirement has a matching manual scenario.

**Commit**
- `docs: add kiosk mode manual verification plan`

## Interface Contracts

### Provides

#### New station route
- Dedicated route for lookup/print station, for example:
  - `/station/lookup-print`

#### Lookup & Print page contract
- Search input accepts customer name, order number, or pickup code.
- Results expose only safe station actions.
- Printing opens a new tab/window so the original station page remains in place.

#### Reusable back button contract
```tsx
<BackToStationHomeButton to="/pickup" label="Back to Pickup Lookup" />
```
- `to` defaults to `/station`
- `label` defaults to current button text when omitted

### Requires

- Kiosk allowlist and landing-route config from sub-spec 2.
- Existing print pages and shared print components.
- Existing search APIs for customers, orders, and sellers.

### Shared State

- `StationHomePage` should remain the outside-kiosk chooser, but kiosk profiles should land directly on their assigned station page.
- `PickupScanPage` and the dedicated lookup/print page must use copy that matches the kiosk shell labels.
- Print pages must stay generic enough to work both in kiosk and non-kiosk flows.

### Verification For Completion

This phase is complete when:
- `Pickup` kiosk keeps volunteers inside pickup lookup and scan workflows.
- `Lookup & Print` kiosk never exposes the broad `Orders` page.
- Printing leaves the operator anchored in their station workflow.
- No kiosk-facing empty state or recovery action sends volunteers to `/walkup/new`.

## Verification Commands

### Focused frontend helper tests
```powershell
Set-Location web
 node --test --experimental-strip-types src/pages/lookupprint/lookupPrintSearch.test.ts
```

### Build check
```powershell
Set-Location web
 npm run build
```

### Manual station checks
1. Enable `pickup` kiosk and confirm the landing page is `/pickup`.
2. Open an order and verify the visible `Back to Lookup` action returns to `/pickup`.
3. Enable `lookup-print` kiosk and confirm the landing page is the dedicated station page, not `/orders`.
4. Search by name, order number, and pickup code; confirm the page remains search-and-print focused.
5. Trigger a no-match state and confirm there is no `Create walk-up` path.
6. Print from the lookup/print station and verify the original station tab remains open.
7. Review the updated in-app docs and printed cheat sheets for terminology consistency.
