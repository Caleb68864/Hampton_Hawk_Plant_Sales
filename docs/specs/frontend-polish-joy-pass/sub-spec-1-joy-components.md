---
sub_spec_id: SS-01
phase: run
depends_on: []
master_spec: "../2026-04-25-frontend-polish-joy-pass.md"
title: "Joy components + typography"
---

# SS-01: Joy components + typography

## Scope
Add six new shared components, self-host Fraunces and Manrope, add `joy.css`, opt three pages in to the new vocabulary.

## Files to Touch
- `web/package.json` (modify -- add `@fontsource/fraunces` and `@fontsource/manrope`)
- `web/src/main.tsx` (modify -- import font CSS)
- `web/src/index.css` (modify -- add font-family tokens via `@theme`)
- `web/src/styles/joy.css` (new)
- `web/src/components/shared/TouchButton.tsx` (new)
- `web/src/components/shared/SectionHeading.tsx` (new)
- `web/src/components/shared/BotanicalEmptyState.tsx` (new)
- `web/src/components/shared/BrandedStationGreeting.tsx` (new)
- `web/src/components/pickup/ScanSuccessFlash.tsx` (new)
- `web/src/components/pickup/OrderCompleteCelebration.tsx` (new)
- `web/src/pages/station/StationHomePage.tsx` (modify)
- `web/src/pages/pickup/PickupLookupPage.tsx` (modify)
- `web/src/pages/pickup/PickupScanPage.tsx` (modify)

## Reference
- Demo: `docs/plans/joy-pass-demo.html` is the canonical visual reference. Match the *feel*, not pixel-perfect.

## Patterns to Follow
- Existing component structure: `web/src/components/shared/SearchBar.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx`.
- Existing page style: `KioskLayout.tsx` already uses the brand bar + gold border pattern.
- Tailwind v4 `@theme` token convention: see `web/src/index.css` lines 4-30.

## Implementation Steps

1. **Install fonts:** `cd web && npm install @fontsource/fraunces @fontsource/manrope` (or matching variable variants if available).
2. **Import fonts at app entry:** in `web/src/main.tsx`, add at the top of imports:
   ```ts
   import '@fontsource/fraunces/variable.css';
   import '@fontsource/manrope/variable.css';
   ```
3. **Add font tokens** in `web/src/index.css` inside the `@theme` block:
   ```css
   --font-display: 'Fraunces', Georgia, serif;
   --font-body: 'Manrope', system-ui, sans-serif;
   ```
4. **Create `web/src/styles/joy.css`** with:
   - Depth shadow utility class `.joy-shadow-plum` matching the demo's `--plum-shadow`.
   - Keyframes `pop`, `ring`, `stamp`, `fall` from the demo.
   - A `.paper-grain` background utility.
   - A `@media (prefers-reduced-motion: reduce)` block disabling those keyframes (`animation: none !important;`).
   - Import this stylesheet from `web/src/main.tsx` after the font imports.
5. **Implement `TouchButton.tsx`:** props `{ variant?: 'primary' | 'gold' | 'ghost' | 'danger'; children; onClick?; type?; disabled?; className?; ... }`. Use a base class with `min-h-14 min-w-14` (Tailwind 14 = 56px), padding, font-weight, and variant-specific gradients/shadows from the demo. `:active` translates 1px down. Default variant: `primary`.
6. **Implement `SectionHeading.tsx`:** props `{ level?: 1 | 2 | 3; eyebrow?: string; accent?: string; children }`. Renders an h1/h2/h3 in `font-display` with `font-variation-settings: 'opsz' 144, 'SOFT' 80, 'wght' 500;`. Optional gold-italic accent word.
7. **Implement `BotanicalEmptyState.tsx`:** props `{ title: string; description?: string; action?: ReactNode }`. Renders a CSS-only seed glyph (radial-gradient, rotate -12deg), Fraunces title, Manrope description, optional action slot.
8. **Implement `BrandedStationGreeting.tsx`:** props `{ workstationName: string; saleStatus?: 'open' | 'closed'; stats?: { ordersDone: number; plantsOut: number; inProgress: number }; quickActions: Array<{ icon: ReactNode; title: string; description: string; onClick: () => void }> }`. Renders the demo's home grid: greeting + ribbon + lede on the left, stats card + quick-action cards on the right.
9. **Implement `ScanSuccessFlash.tsx`:** props `{ visible: boolean; plantName: string; sku?: string; barcode?: string; remainingForOrder?: number; onAnimationEnd?: () => void }`. When `visible` flips to true, animates the `.checkbloom` (480ms `pop` + `ring`); calls `onAnimationEnd` after ~520ms so the parent can clear it.
10. **Implement `OrderCompleteCelebration.tsx`:** props `{ visible: boolean; orderNumber: string; customerName?: string; onComplete?: () => void }`. Shows the dashed-gold rubber stamp + 8-piece confetti staggered animation. Fires `onComplete` after ~700ms; parent then calls `navigate('/pickup')`.
11. **Opt in `StationHomePage.tsx`:** replace existing greeting with `<BrandedStationGreeting>`. Wire stats from existing dashboard-metrics hook (or a placeholder if not yet available).
12. **Opt in `PickupLookupPage.tsx`:** swap the page heading to `<SectionHeading>`. Wrap the search input in a gold-trim shell (matching demo). Replace primary buttons with `<TouchButton>`. Use `<BotanicalEmptyState>` for the empty results case.
13. **Opt in `PickupScanPage.tsx`:**
    - Replace primary actions (Complete Order, Manual Fulfill, Undo, Recover) with `<TouchButton>` instances.
    - Render `<ScanSuccessFlash>` above the scan input. Drive `visible` from a transient state (e.g., `lastSuccessScan` cleared after 520ms).
    - On Complete Order success, set state showing `<OrderCompleteCelebration>`; on its `onComplete`, `navigate('/pickup')`.
    - Hoist the action bar above-the-fold (matches Quick Wins SS-02 touch-friendly layout requirement).
14. **Run `npm run build`** and resolve any TypeScript errors.
15. **Manual smoke** with `start.bat` running:
    - `/station` shows Fraunces heading, gold ribbon, stats card, four quick-action cards.
    - `/pickup` shows gold-trim input + Section heading + BotanicalEmptyState when filtered to nothing.
    - `/pickup/{orderId}` shows TouchButton on Complete Order; scan flash animates; Complete Order triggers celebration then redirects.
    - DevTools "prefers-reduced-motion: reduce" disables animations.

## Interface Contracts

### Provides
- `TouchButton` (consumed by Quick Wins SS-02, Quick Wins SS-04, Walk-up SS-03, Pick-list SS-03)
- `SectionHeading` (consumed by Quick Wins SS-02, Quick Wins SS-06, Walk-up SS-03, Pick-list SS-03)
- `BotanicalEmptyState` (consumed by Quick Wins SS-04, Quick Wins SS-06, Pick-list SS-03)
- `ScanSuccessFlash`, `OrderCompleteCelebration` (consumed by Quick Wins SS-02, Pick-list SS-03)
- `BrandedStationGreeting` (consumed by Walk-up SS-04 station home updates)
- `joy.css` shared keyframes + reduced-motion handling

### Requires
- None (foundational; should land in Wave 1).

## Verification Commands

```sh
cd web
npm install
npm run build
grep -r "fonts.googleapis.com" web/dist 2>/dev/null && echo "FAIL: CDN fonts leaked" || echo "OK: no CDN fonts"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| TouchButton component exists | [STRUCTURAL] | `test -f web/src/components/shared/TouchButton.tsx \|\| (echo "FAIL: TouchButton missing" && exit 1)` |
| SectionHeading exists | [STRUCTURAL] | `test -f web/src/components/shared/SectionHeading.tsx \|\| (echo "FAIL: SectionHeading missing" && exit 1)` |
| BotanicalEmptyState exists | [STRUCTURAL] | `test -f web/src/components/shared/BotanicalEmptyState.tsx \|\| (echo "FAIL: BotanicalEmptyState missing" && exit 1)` |
| BrandedStationGreeting exists | [STRUCTURAL] | `test -f web/src/components/shared/BrandedStationGreeting.tsx \|\| (echo "FAIL: BrandedStationGreeting missing" && exit 1)` |
| ScanSuccessFlash exists | [STRUCTURAL] | `test -f web/src/components/pickup/ScanSuccessFlash.tsx \|\| (echo "FAIL: ScanSuccessFlash missing" && exit 1)` |
| OrderCompleteCelebration exists | [STRUCTURAL] | `test -f web/src/components/pickup/OrderCompleteCelebration.tsx \|\| (echo "FAIL: OrderCompleteCelebration missing" && exit 1)` |
| joy.css exists with keyframes | [STRUCTURAL] | `test -f web/src/styles/joy.css && grep -q "@keyframes pop" web/src/styles/joy.css && grep -q "prefers-reduced-motion" web/src/styles/joy.css \|\| (echo "FAIL: joy.css incomplete" && exit 1)` |
| @fontsource packages added | [STRUCTURAL] | `grep -q "@fontsource/fraunces" web/package.json && grep -q "@fontsource/manrope" web/package.json \|\| (echo "FAIL: @fontsource packages not in package.json" && exit 1)` |
| Fonts imported at entry | [STRUCTURAL] | `grep -q "@fontsource/fraunces" web/src/main.tsx \|\| (echo "FAIL: fonts not imported in main.tsx" && exit 1)` |
| TouchButton has 56px hit target | [STRUCTURAL] | `grep -q "min-h-14\\|min-h-\\[56px\\]\\|min-height: 56" web/src/components/shared/TouchButton.tsx \|\| (echo "FAIL: TouchButton hit target not enforced" && exit 1)` |
| StationHomePage uses BrandedStationGreeting | [STRUCTURAL] | `grep -q "BrandedStationGreeting" web/src/pages/station/StationHomePage.tsx \|\| (echo "FAIL: StationHomePage not using BrandedStationGreeting" && exit 1)` |
| PickupScanPage uses ScanSuccessFlash | [STRUCTURAL] | `grep -q "ScanSuccessFlash" web/src/pages/pickup/PickupScanPage.tsx \|\| (echo "FAIL: PickupScanPage not using ScanSuccessFlash" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
| No CDN fonts leaked into build | [MECHANICAL] | `! grep -rq "fonts.googleapis.com" web/dist 2>/dev/null \|\| (echo "FAIL: CDN font URL found in build" && exit 1)` |
