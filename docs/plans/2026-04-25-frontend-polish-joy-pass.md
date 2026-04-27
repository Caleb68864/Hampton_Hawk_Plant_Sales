---
date: 2026-04-25
topic: "Frontend polish: high-frequency joy moments for sale-day volunteers"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-25
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

## Commander's Intent
**Desired End State:** Six new shared React/TypeScript components ship under `web/src/components/`: `TouchButton`, `SectionHeading`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `BotanicalEmptyState`, `BrandedStationGreeting`. Fraunces and Manrope are bundled via `@fontsource/*` so kiosks work offline. `web/src/styles/joy.css` carries the depth shadows and paper-grain utility. `StationHomePage`, `PickupLookupPage`, and `PickupScanPage` opt in to the new vocabulary. `WalkUpRegisterPage` (from Walk-up SS-03), `OrdersListPage` (from Quick Wins SS-04), and the new report pages (Quick Wins SS-06) reference the same components so the whole product feels coherent.

**Purpose:** Sale-day volunteers run the kiosks under pressure. The current UI is functional but generic. Polishing the high-frequency moments -- start of shift, every scan, every Complete Order, every empty state -- raises perceived quality without adding workflow steps. The design aesthetic stays inside the existing Hampton Hawks purple+gold palette so nothing about the brand changes; only the typography, spacing, depth, and animation layer changes.

**Constraints (MUST):**
- MUST stay inside the existing `--color-hawk-*` and `--color-gold-*` CSS variables defined in `web/src/index.css`. No new palette.
- MUST self-host fonts via `@fontsource/fraunces` and `@fontsource/manrope`. Kiosks may be offline at sale time.
- MUST satisfy `prefers-reduced-motion`: all bloom/confetti/stamp animations have a static fallback.
- MUST keep min-hit-target ≥56x56 CSS px on every primary action button (touchscreen POS).
- MUST not regress Lighthouse Performance on `/station` by more than 3 points.
- MUST be additive: every page is opt-in. No existing page breaks if a component is deleted or renamed.
- All new components MUST be TypeScript with explicit prop types and exported via the existing `web/src/components/` convention.

**Constraints (MUST NOT):**
- MUST NOT add a new color palette, replace the existing one, or invert to dark mode.
- MUST NOT pull in a new CSS framework, a CSS-in-JS library, or Storybook.
- MUST NOT replace the existing Tailwind v4 setup or @theme tokens.
- MUST NOT introduce new functional behavior beyond what Quick Wins SS-02 already specifies (this is a presentation layer).
- MUST NOT add an icon library; use inline SVGs.
- MUST NOT add CDN-loaded fonts in production.

**Freedoms (the implementing agent MAY):**
- MAY pick the exact bundling approach for `@fontsource/*` (entry-import vs. CSS-import) consistent with Vite's recommended pattern.
- MAY choose any compositor-friendly animation API (CSS keyframes, Motion library, Framer Motion); prefer CSS-only for the Lighthouse budget.
- MAY adjust copy on empty states, success flashes, and stamps to match the existing project tone.
- MAY tweak shadow/radius values within the spirit of the demo (`docs/plans/joy-pass-demo.html`) -- pixel-perfect match is not required; the *feel* must match.
- MAY add internal helper components not listed (e.g., `JoyConfettiBurst`) if the implementation benefits.

## Execution Guidance
**Observe (signals):**
- `npm run build` succeeds with no new TypeScript or eslint regressions.
- Lighthouse Performance/Accessibility/Best-Practices on `/station` and `/pickup` after the polish pass.
- `prefers-reduced-motion: reduce` honored (test via DevTools emulation).
- No new console warnings on any kiosk page.

**Orient (codebase conventions):**
- Tailwind v4 with `@theme` tokens in `web/src/index.css`. New tokens (shadows, radii, font families) belong there.
- Components live in `web/src/components/` organized by feature folder (`shared/`, `pickup/`, `orders/`, etc.).
- Existing `KioskLayout.tsx` and `AppLayout.tsx` already use the brand palette; opt-in pages drop in new components, do not edit layouts.
- TypeScript: explicit prop types; no `any`.
- All animations should run on `transform` and `opacity` only.

**Escalate when:**
- A new external npm dependency beyond `@fontsource/fraunces` and `@fontsource/manrope` is required.
- Lighthouse Performance score drops more than 3 points on any kiosk page.
- An existing page breaks when the polish components are introduced.
- An animation library is needed (Motion, Framer Motion) -- escalate before adding.
- The aesthetic in `joy-pass-demo.html` cannot be reasonably matched without departing from constraints.

**Shortcuts (apply without deliberation):**
- `TouchButton` variants come straight from the demo's `.btn-primary`, `.btn-gold`, `.btn-ghost`, `.btn-danger` classes -- translate to a single component with a `variant` prop.
- `SectionHeading` uses Fraunces `font-variation-settings: 'opsz' 144, 'SOFT' 80, 'wght' 500`.
- `ScanSuccessFlash` clones the demo's `.checkbloom` keyframes (`pop` + `ring`).
- `OrderCompleteCelebration` clones the demo's `.stamp` keyframes and the 8-piece confetti staggered animation-delays.
- `BotanicalEmptyState` clones the demo's `.empty .seed` glyph (CSS-only, no SVG).
- Self-host fonts with `@fontsource/fraunces/variable.css` and `@fontsource/manrope/variable.css` imported once at app entry.

## Decision Authority
**Agent decides autonomously:**
- Component file layout, internal helper extraction, prop names.
- Exact shadow / radius / animation-duration values (within demo spirit).
- Test file placement and unit-test structure (if added).
- Inline SVG vs. CSS-only glyph for any specific decoration.
- TypeScript prop typing details.

**Agent recommends, human approves:**
- Whether to use Motion library (recommend NO; CSS keyframes are sufficient).
- Specific copy on empty states and celebration messages (recommend matching the demo verbatim).
- Whether to adopt `@fontsource/*` package versioning beyond what's on the latest stable.

**Human decides:**
- Whether to roll out polish to all pages at once vs. opt-in incrementally.
- Whether the touchscreen tap test (the `[HUMAN REVIEW]` criterion) is acceptable on the production mini-PC.
- Whether dark mode is ever desired (out of scope for this pass).

## War-Game Results
**Most likely failure -- offline kiosk gets unstyled fonts.**
A kiosk without internet renders default browser serif/sans until cached fonts arrive. With self-hosted `@fontsource/*`, fonts ship inside the build, so cold-start on a never-connected kiosk works. Acceptance: verify by running the prod build, disconnecting the network, hard-reloading -- Fraunces and Manrope still render.

**Scale stress -- animation jank on the production mini-PC.**
The mini-PC runs the API, Postgres, and the web server. Browser tab is on a separate host (the kiosk PC). Rendering the polish should be irrelevant to the host's load. On the kiosk side, the animations are GPU-cheap (transform + opacity). Worst-case: a low-end kiosk drops a few frames in the confetti; the celebration completes anyway. Acceptable.

**Dependency disruption -- @fontsource breaking changes.**
Pin the version. Run `npm audit` quarterly. No exotic dependencies added.

**6-month maintenance assessment.**
A new contributor reading the polish spec + the demo HTML can rebuild any component without context. The visual vocabulary is small (six components + a stylesheet). Component names match what they do. The demo is the canonical reference; maintainers can iterate against it.

## Evaluation Metadata
- Evaluated: 2026-04-25
- Cynefin Domain: Complicated (known patterns: typography upgrade, animation choreography, accessible component design)
- Critical Gaps Found: 0
- Important Gaps Found: 0
- Suggestions: 0
- Framework layers added: Commander's Intent, Execution Guidance, Decision Authority, War-Game Results

## Next Steps
- [ ] Auto-chain: `/forge` -> `/forge-prep` -> `/forge-red-team`
- [ ] Resolve open questions (font hosting confirmed -- self-host)
- [ ] Ship as the trailing PR after Quick Wins SS-02 lands so the `TouchButton` API is canonical
