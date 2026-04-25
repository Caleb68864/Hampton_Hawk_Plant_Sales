---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Scan UX -- frontend changes"
---

# SS-02: Scan UX -- frontend changes

## Scope
Wire `appStore` settings to the new tunables. Update `PickupLookupPage` auto-jump logic. Update `PickupScanPage` for multi-scan, post-complete redirect, and touch-friendly above-the-fold action layout. Add Settings page "Scanner Tuning" admin section.

## Files to Touch
- `web/src/stores/appStore.ts` (modify)
- `web/src/api/settings.ts` (modify -- add `updateScannerTuning`)
- `web/src/types/settings.ts` (modify -- AppSettings extended type)
- `web/src/pages/pickup/PickupLookupPage.tsx` (modify)
- `web/src/pages/pickup/PickupScanPage.tsx` (modify)
- `web/src/pages/SettingsPage.tsx` (modify)
- `web/src/utils/orderLookup.ts` (no change required; existing helpers preserved)
- `web/src/components/shared/TouchButton.tsx` (new shared component for touch-friendly action buttons)

## Patterns to Follow
- API client: see `web/src/api/orders.ts`.
- Zustand store extension: see existing `appStore.ts` slice for `saleClosed`.
- Form on `SettingsPage`: existing inputs follow Tailwind class conventions; admin pin via `useAdminAuth`.
- Reuse `ScanInput`, `ScanFeedbackBanner`, `ItemsRemainingCounter` from `web/src/components/pickup/`.

## Implementation Steps

1. **Extend `web/src/types/settings.ts`:** add `pickupSearchDebounceMs?: number`, `pickupAutoJumpMode?: 'ExactMatchOnly' | 'BestMatchWhenSingle'`, `pickupMultiScanEnabled?: boolean` to `AppSettings`.
2. **Add `settingsApi.updateScannerTuning`** in `web/src/api/settings.ts`: PUT to `/api/settings/scanner-tuning`, includes admin pin headers.
3. **Extend `appStore`:** add a selector for the three new fields with sensible defaults (120 / `BestMatchWhenSingle` / true) when API hasn't returned yet.
4. **Update `PickupLookupPage.tsx`:**
   - Read `pickupSearchDebounceMs` from `appStore`; pass to `<SearchBar debounceMs={...}>`.
   - In the auto-jump effect (where `nextExactMatches.length === 1` is checked), gate by `pickupAutoJumpMode === 'BestMatchWhenSingle'` to bypass the `looksLikeOrderNumberLookup` check; keep the existing path under `ExactMatchOnly`.
5. **Add `TouchButton` component** with classes ensuring min-height/min-width 44px (e.g., `min-h-11 min-w-11 px-4 py-3 text-base font-medium rounded-md`). Variants: `primary`, `danger`, `secondary`.
6. **Update `PickupScanPage.tsx`:**
   - Hoist primary actions (Complete Order, Manual Fulfill, Undo Last Scan, Recover) into an action bar that renders directly under the scan input, above the scan history.
   - Replace existing buttons with `TouchButton` instances.
   - On `Complete Order` success: `navigate('/pickup')` (already routes to lookup page; existing useEffect on lookup focuses input on mount).
   - Multi-scan: confirm `useScanWorkflow` already supports rapid input; if a modal currently blocks between scans, replace with inline feedback only.
7. **Update `SettingsPage.tsx`:** add a new "Scanner Tuning" section gated by `useAdminAuth` requirement. Inputs: number for debounce (50-500), select for auto-jump mode, checkbox for multi-scan. Save button calls `settingsApi.updateScannerTuning(...)`.
8. **Run `npm run build`** and fix any TypeScript errors.
9. **Manual smoke:** with `start.bat` running, change debounce to 80, reload kiosk; verify scan input responsiveness; scan a barcode that previously didn't auto-jump and confirm it does in `BestMatchWhenSingle` mode; on scan page, verify Complete Order is visible without scrolling at 1024×768; tap-test buttons on a touch-emulated viewport.

## Interface Contracts

### Provides
- `TouchButton` shared component (potentially used by SS-04 for bulk-action toolbar).

### Requires
- From SS-01: `SettingsResponse` shape including the three new fields.
- From SS-01: server enforcement of debounce range (50-500), so frontend can rely on server validation.

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| AppSettings type has new fields | [STRUCTURAL] | `grep -q "pickupSearchDebounceMs" web/src/types/settings.ts \|\| (echo "FAIL: settings type missing pickupSearchDebounceMs" && exit 1)` |
| settingsApi has updateScannerTuning | [STRUCTURAL] | `grep -q "updateScannerTuning" web/src/api/settings.ts \|\| (echo "FAIL: settings api missing updateScannerTuning" && exit 1)` |
| TouchButton component exists | [STRUCTURAL] | `test -f web/src/components/shared/TouchButton.tsx \|\| (echo "FAIL: TouchButton component missing" && exit 1)` |
| TouchButton enforces min size | [STRUCTURAL] | `grep -q "min-h-11" web/src/components/shared/TouchButton.tsx \|\| (echo "FAIL: TouchButton lacks min-h-11 (44px) hit target" && exit 1)` |
| PickupLookupPage references pickupAutoJumpMode | [STRUCTURAL] | `grep -q "pickupAutoJumpMode" web/src/pages/pickup/PickupLookupPage.tsx \|\| (echo "FAIL: PickupLookupPage does not consume pickupAutoJumpMode" && exit 1)` |
| PickupScanPage uses TouchButton | [STRUCTURAL] | `grep -q "TouchButton" web/src/pages/pickup/PickupScanPage.tsx \|\| (echo "FAIL: PickupScanPage not using TouchButton" && exit 1)` |
| Settings page has scanner tuning section | [STRUCTURAL] | `grep -q "Scanner Tuning" web/src/pages/SettingsPage.tsx \|\| (echo "FAIL: SettingsPage missing Scanner Tuning section" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
