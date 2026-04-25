---
date: 2026-04-25
topic: "Frontend polish: high-frequency joy moments for sale-day volunteers"
author: Caleb Bennett
status: draft
tags:
  - design
  - frontend-polish
  - joy-pass
  - hampton-hawks-plant-sales
preview: docs/plans/joy-pass-demo.html
---

# Frontend Joy Pass -- Design

## Summary
A small, focused polish pass on the React kiosk and admin pages so that the high-frequency moments of a sale day -- starting a shift, scanning a plant, completing an order, hitting an out-of-stock prompt -- feel intentional, calm, and slightly delightful. No structural rewrites, no new aesthetic; tightens the existing Hampton Hawks purple+gold identity by adding a warm display serif (Fraunces), a tactile button system tuned for touchscreen POS terminals, and four animated states that volunteers see hundreds of times per shift. Reference preview at `docs/plans/joy-pass-demo.html` (open in any browser).

## Approach Selected
**Approach B: Component-level polish layered onto existing pages.**

Three approaches were considered:

- **A -- Wholesale visual rewrite.** Replace pages with a new design system. Rejected -- the existing palette and KioskLayout already work; rewriting risks breaking shipped flows and introduces an enormous regression surface days before another sale.
- **B (Selected) -- Component polish + typography upgrade.** Add a new shared component set (`TouchButton`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `BotanicalEmptyState`, `SectionHeading`), a Fraunces+Manrope font load, and ~80 lines of CSS variables for shadows / depth. Existing pages opt in by swapping to the new components.
- **C -- Animation-only pass.** Add Motion animations to existing components without typography changes. Rejected -- typography is the highest-leverage upgrade for "feels intentional"; without it, animations feel decorative.

**Why B:** Reuses the Hampton Hawks brand palette already defined in `web/src/index.css` (`--color-hawk-*`, `--color-gold-*`); each component is independently usable; pages opt in incrementally; no risk to existing functionality.

## Aesthetic Direction
**Warm, regal, botanical-academic.** Hampton Hawks royal purple + gold remains dominant. A variable display serif (Fraunces, with optical-size and SOFT axes) replaces the default Tailwind sans for headings and key numbers; Manrope handles body text. A faint paper-grain background layer, thin gold dashed inner borders on the scan input, and a small set of stamp/bloom animations on success states evoke a vintage seed packet or a school yearbook spread without being precious about it. The effect: the app stops feeling like a generic admin panel and starts feeling like *the* Hampton Hawks plant sale tool.

**Touchstones:** vintage seed packets, gilded yearbook covers, the "Ready" rubber stamp on a hand-checked invoice.

## Architecture

```
web/src/
  index.css                                <-- add font-family vars, depth shadows
  styles/joy.css                           <-- new: component-scoped polish styles
  components/
    shared/
      TouchButton.tsx                      <-- new (also referenced from Quick Wins SS-02)
      SectionHeading.tsx                   <-- new (Fraunces display headings)
      BotanicalEmptyState.tsx              <-- new (replaces generic "no data")
    pickup/
      ScanSuccessFlash.tsx                 <-- new (the high-frequency joy)
      OrderCompleteCelebration.tsx         <-- new (stamp + confetti closure)
  pages/
    station/StationHomePage.tsx            <-- opt in: greeting + stats card + quick actions
    pickup/PickupLookupPage.tsx            <-- opt in: gold-trim input shell + section heading
    pickup/PickupScanPage.tsx              <-- opt in: TouchButton + ScanSuccessFlash + OrderCompleteCelebration
    walkup/WalkUpRegisterPage.tsx          <-- opt in: TouchButton + ScanSuccessFlash + out-of-stock card
    orders/OrdersListPage.tsx              <-- opt in: BotanicalEmptyState
```

Tailwind v4 already drives this project; the new styles slot into `@theme` and a small additional stylesheet rather than introducing a CSS-in-JS layer.

## Components

**`TouchButton`** -- the foundational element. Three variants (`primary`, `gold`, `ghost`, `danger`). Min hit target 56x56 CSS px (above 44 baseline; sized for fast volunteer taps). Layered shadow gives a gilded letterpress feel on press; `:active` translates 1px down for haptic-style feedback. Replaces buttons on `PickupScanPage`, `WalkUpRegisterPage`, `StationHomePage`, and the `BulkActionToolbar`. (Also satisfies the Quick Wins SS-02 touch-friendly criterion.)

**`SectionHeading`** -- Fraunces display headings with optical-size 144, SOFT axis 80 for warmth. Replaces the existing Tailwind `text-2xl font-bold text-gray-800` patterns on every kiosk page. Optional italic accent word in `--gold-700`.

**`ScanSuccessFlash`** -- 480ms spring animation when a scan resolves to `Accepted`. A radial gilded "bloom" ring expands behind a check icon, the plant name renders in Fraunces 32px, and a "Remaining for this order" pill shows the live decreasing count. Lives at the top of `PickupScanPage` above the scan input. The high-frequency moment of a sale day; needs to feel earned, not noisy. Audio remains the existing `useAudioFeedback` chime; this is purely visual reinforcement.

**`OrderCompleteCelebration`** -- shown when the operator presses Complete Order on `PickupScanPage`. A "All Picked - Ready" rubber-stamp in dashed gold (Fraunces italic, 34px, rotated -3 degrees) springs in with eight confetti slivers in alternating purple/gold. Then `navigate('/pickup')` per Quick Wins SS-02 post-complete redirect. The animation lasts ~700ms; the redirect waits for it to finish.

**`BotanicalEmptyState`** -- replaces `EmptyState` calls in list pages. A small gilded "seed" glyph, a Fraunces heading, friendly Manrope body copy that explains *why* there are no results and offers a clear next action. Used on `OrdersListPage` (filtered to nothing), `PickupLookupPage` (no orders match search), `WalkUpRegisterPage` ("no open tickets"), and the new sales-by-* report pages.

**`BrandedStationGreeting`** -- the redesigned `StationHomePage` greeting block: a contextual greeting ("Good morning, Pickup Station 1."), a sale-day status ribbon (gold pill with pulsing dot), and a stats card showing today's orders done / plants out / in progress. Quick-action cards underneath open the four primary kiosk flows.

## Data Flow
None. This is a pure presentational layer. No new API calls, no new state. Each component reads its props (or, in the case of `BrandedStationGreeting`, the existing dashboard-metrics hook) and renders.

## Error Handling
- **Font load failure:** Fraunces and Manrope are loaded via Google Fonts with `font-display: swap`; native serif/sans fallbacks render until the web fonts arrive. No flash of invisible text. If the network blocks fonts entirely (offline kiosk), the layout still works.
- **Animation jank on slow hardware:** all animations use compositor-friendly properties (`transform`, `opacity`). On a low-end mini-PC, frames may drop slightly but the animation completes. If a kiosk is severely starved, `prefers-reduced-motion` disables the bloom and confetti and replaces them with a single fade-in.
- **Component opt-in:** if a page isn't ready for a polished component, the old code keeps working. Roll-out is page-by-page.

## Success Criteria
- A volunteer at a touchscreen POS can complete a 5-plant pickup scan from start to finish without scrolling or hunting for a button. Complete Order is visible above-the-fold next to the barcode input.
- Every successful scan plays the `ScanSuccessFlash` and shows the plant name in a clearly readable display face. Volunteers know in <500ms that the scan worked.
- Every Complete Order action plays the `OrderCompleteCelebration` and routes back to lookup with the search input focused.
- Empty states no longer say "No results found." They say something specific and offer a next action, in a typography that matches the rest of the site.
- The display font (Fraunces) loads on every page that uses `SectionHeading`. Lighthouse Performance score on `/station` does not drop more than 3 points after the polish pass.
- `prefers-reduced-motion` users see static versions of every animation.

## Exclusions
- No restructuring of existing pages or routes.
- No changes to functional behavior beyond what Quick Wins SS-02 already specifies.
- No new analytics/telemetry.
- No internationalization beyond English (the school sale is English-only).
- No new CSS framework, no migration to CSS-in-JS, no Storybook setup.
- No icon library beyond inline SVGs (avoid adding lucide-react, etc., for one pass).
- No dark mode (kiosks are bright daylight environments).

## Open Questions
- **Font hosting:** Google Fonts CDN (simplest) vs. self-hosted via `@fontsource/fraunces` and `@fontsource/manrope` (offline-friendly)? Recommendation: self-host. The Docker stack runs locally during a sale; Internet may not always be available.
- **Audio coupling:** `ScanSuccessFlash` should fire alongside the existing audio chime, not in place of it. Confirm the existing `useAudioFeedback` hook fires synchronously with the scan response so the visual + audio cues land together.
- **Confetti accessibility:** confetti is decorative only. `aria-hidden="true"` on the container is sufficient; confirm screen-reader behavior on the success message.

## Approaches Considered
- **A: Wholesale visual rewrite.** Rejected -- regression risk too high before next sale; existing brand bar already works.
- **B (Selected): Component polish + typography upgrade.** Lowest-risk path that delivers the highest-leverage moments.
- **C: Animation-only.** Rejected -- without typography upgrade, animations feel like decoration.

## Integration with Other Specs
- **Quick Wins SS-02 (Scan UX frontend)** already specifies a `TouchButton` shared component. This polish spec produces the canonical implementation; SS-02 consumes it. If SS-02 lands first, that worker can build a minimal `TouchButton` and this polish pass refines it.
- **Walk-up SS-03 (WalkUpRegisterPage)** consumes `TouchButton` and `ScanSuccessFlash` directly. The two specs share the same component vocabulary so the cash-register page and the pickup page feel like the same product.
- **Pick-list SS-03 (PickupScanSessionPage)** consumes `ScanSuccessFlash` for per-plant scan success in the aggregated session.

## Phase Plan (single phase)

**SS-01 -- Joy components + typography**
- Add Fraunces + Manrope (self-hosted via `@fontsource/*`).
- Add `web/src/styles/joy.css` with depth shadows + paper-grain background utility.
- Implement `TouchButton`, `SectionHeading`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `BotanicalEmptyState`, `BrandedStationGreeting`.
- Opt in `StationHomePage`, `PickupLookupPage`, `PickupScanPage` first (the trio that drives sale-day flow); leave `OrdersListPage`, `WalkUpRegisterPage`, and report pages for an immediate follow-up so they pick up the new vocabulary as they ship.
- Acceptance criteria:
  - `[STRUCTURAL]` All five components exist under `web/src/components/`.
  - `[STRUCTURAL]` Fraunces and Manrope are bundled via `@fontsource/*` (no Google Fonts CDN in production build).
  - `[BEHAVIORAL]` Scanning a plant on `PickupScanPage` triggers `ScanSuccessFlash` for ~480ms, then accepts the next scan immediately.
  - `[BEHAVIORAL]` Pressing Complete Order on `PickupScanPage` triggers `OrderCompleteCelebration` for ~700ms, then navigates to `/pickup`.
  - `[STRUCTURAL]` `prefers-reduced-motion` media query disables bloom/confetti animations.
  - `[HUMAN REVIEW]` On a 1024x768 touchscreen POS terminal, a volunteer can tap every primary action (Complete Order, Override, Cancel) on the first try without scrolling.
  - `[MECHANICAL]` Lighthouse Performance score on `/station` drops by no more than 3 points compared to pre-polish baseline.
  - `[MECHANICAL]` `npm run build` succeeds with no new TypeScript errors and no new eslint regressions.

## Next Steps
- [ ] User opens `docs/plans/joy-pass-demo.html` in a browser to confirm the aesthetic direction
- [ ] Resolve open questions (font hosting in particular)
- [ ] Forge into a small spec via `/forge docs/plans/2026-04-25-frontend-polish-joy-pass.md`
- [ ] Ship as the trailing PR after Quick Wins SS-02 lands so the `TouchButton` API is canonical
