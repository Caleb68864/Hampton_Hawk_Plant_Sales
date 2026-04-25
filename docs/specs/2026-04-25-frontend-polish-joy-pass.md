# Frontend Polish -- Joy Pass

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-25
- Author: Caleb Bennett
- Source: `docs/plans/2026-04-25-frontend-polish-joy-pass.md` (evaluated)
- Preview: `docs/plans/joy-pass-demo.html`
- Status: ready-to-execute
- Quality scores: Outcome 5 / Scope 5 / Decision 5 / Edges 4 / Criteria 4 / Decomposition 5 / Purpose 5 — **Total 33/35**

## Outcome
A single PR adds six shared components, self-hosted Fraunces+Manrope, and a small `joy.css`. Three opt-in pages (`StationHomePage`, `PickupLookupPage`, `PickupScanPage`) consume the new vocabulary on first ship; `OrdersListPage`, `WalkUpRegisterPage`, and the new report pages pick it up as their own bundles land. No existing functional behavior changes; no palette changes; no new framework. Sale-day volunteers see the warm display serif on every heading, tactile gilded buttons on every primary action, a satisfying scan-success bloom on every scan, and a celebratory stamp on every Complete Order.

## Intent
**Trade-off hierarchy:**
- **Existing palette and patterns over invention.** No new colors; no new framework.
- **Offline-first over CDN ergonomics.** Fonts self-hosted via `@fontsource/*` so kiosks render correctly without a network.
- **CSS-only animations over JS animation libraries** unless an animation absolutely requires JS orchestration.
- **Auditable, additive change.** Pages opt in. Removing the polish is a one-line revert per page.

**Decision boundaries:**
- Decide autonomously: file/folder placement, prop names, helper extraction, exact shadow/radius/duration values within demo spirit.
- Recommend + ask: motion-library adoption (recommend NO), copy on empty/celebration states (recommend matching demo).
- Stop and ask: any need to add a CSS framework or animation library; Lighthouse Performance regression > 3 points; aesthetic departure from `joy-pass-demo.html`.

## Context
The spring 2026 sale ran 5 stations smoothly but the UI was utilitarian. Volunteers (parents, teachers) used touchscreen POS terminals heavily. The aesthetic decision: Hampton Hawks royal purple + gold remain dominant; the warmth comes from a variable display serif (Fraunces) and a clean modern body sans (Manrope). The vocabulary is reusable across the whole product so the new walk-up register, the bulk-action toolbar, the new report pages, and the existing kiosk pages all share one visual language.

Reference preview: open `docs/plans/joy-pass-demo.html` in any browser to see the six target moments and the component vocabulary.

## Requirements

1. Six shared components ship under `web/src/components/`: `TouchButton`, `SectionHeading`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `BotanicalEmptyState`, `BrandedStationGreeting`. Each is TypeScript with explicit prop types.
2. Fraunces and Manrope are bundled offline via `@fontsource/fraunces` and `@fontsource/manrope`. No CDN fonts in production.
3. `web/src/styles/joy.css` is added with depth shadows, paper-grain background utility, and shared keyframes (`pop`, `ring`, `stamp`, `fall`).
4. `StationHomePage`, `PickupLookupPage`, and `PickupScanPage` opt in to the new components.
5. All animations honor `prefers-reduced-motion: reduce` with static fallbacks.
6. `TouchButton` enforces ≥56x56 CSS px hit targets across all variants.
7. `npm run build` succeeds; no new TypeScript errors; no new eslint regressions.
8. Lighthouse Performance score on `/station` and `/pickup` drops by no more than 3 points compared to pre-polish baseline.
9. No existing functional behavior changes; no palette changes; no new external dependencies beyond `@fontsource/*`.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Joy components + typography

- **Scope:** Add the six components, self-host fonts, add `joy.css`, opt three pages in.
- **Files:**
  - `web/package.json` (modify -- add `@fontsource/fraunces` and `@fontsource/manrope`)
  - `web/src/main.tsx` (modify -- import the font CSS once at entry)
  - `web/src/index.css` (modify -- add `--font-display: 'Fraunces'` and `--font-body: 'Manrope'` tokens; map onto Tailwind `font-display` / `font-body` utilities via `@theme`)
  - `web/src/styles/joy.css` (new -- depth shadows, paper-grain, keyframes, reduced-motion media query)
  - `web/src/components/shared/TouchButton.tsx` (new)
  - `web/src/components/shared/SectionHeading.tsx` (new)
  - `web/src/components/shared/BotanicalEmptyState.tsx` (new)
  - `web/src/components/shared/BrandedStationGreeting.tsx` (new)
  - `web/src/components/pickup/ScanSuccessFlash.tsx` (new)
  - `web/src/components/pickup/OrderCompleteCelebration.tsx` (new)
  - `web/src/pages/station/StationHomePage.tsx` (modify -- consume `BrandedStationGreeting`, `SectionHeading`, `TouchButton`)
  - `web/src/pages/pickup/PickupLookupPage.tsx` (modify -- consume `SectionHeading`, gold-trim input shell, `TouchButton`)
  - `web/src/pages/pickup/PickupScanPage.tsx` (modify -- consume `TouchButton`, `ScanSuccessFlash`, `OrderCompleteCelebration`)
- **Acceptance criteria:**
  - `[STRUCTURAL]` Six new component files exist at the listed paths with `export function` signatures and explicit prop type interfaces.
  - `[STRUCTURAL]` `web/package.json` includes `@fontsource/fraunces` and `@fontsource/manrope` in `dependencies` (not `devDependencies`).
  - `[STRUCTURAL]` `web/src/main.tsx` imports the font CSS files once.
  - `[STRUCTURAL]` `web/src/styles/joy.css` defines keyframes `pop`, `ring`, `stamp`, `fall` and a `@media (prefers-reduced-motion: reduce)` block that disables those keyframes (`animation: none`).
  - `[STRUCTURAL]` `TouchButton` enforces `min-height: 56px; min-width: 56px` via shared class; verifiable via grep.
  - `[BEHAVIORAL]` `StationHomePage` renders the new `BrandedStationGreeting` (visible Fraunces display heading + gold ribbon + stats card + four quick-action cards).
  - `[BEHAVIORAL]` `PickupScanPage` shows `ScanSuccessFlash` for ~480ms after every successful scan, then accepts the next scan.
  - `[BEHAVIORAL]` `PickupScanPage` shows `OrderCompleteCelebration` for ~700ms after Complete Order succeeds, then `navigate('/pickup')` (matches Quick Wins SS-02 post-complete redirect).
  - `[BEHAVIORAL]` In a browser with `prefers-reduced-motion: reduce` set, the bloom/confetti/stamp animations do not run; static states render correctly.
  - `[HUMAN REVIEW]` On a 1024x768 touchscreen POS terminal, a volunteer can tap every primary action (Complete Order, Manager Override, Cancel) on the first try without scrolling.
  - `[MECHANICAL]` `cd web && npm run build` succeeds with no new TypeScript or eslint regressions.
  - `[MECHANICAL]` Production build does NOT load any Google Fonts CDN URL (verifiable: `grep -r "fonts.googleapis.com" web/dist || echo "OK"` after build).
- **Dependencies:** none

## Edge Cases
- **Offline kiosk:** Fonts ship in the build, no network needed.
- **Reduced motion:** Static fallback for every animation.
- **Slow GPU:** Transform/opacity-only animations; minimal jank risk.
- **Component opt-in:** Removing a polish component from a page is a one-line revert; old code paths still work.
- **Cross-bundle TouchButton coordination:** Quick Wins SS-02 may also produce a `TouchButton`. If this Joy Pass spec lands first, SS-02 just imports it. If SS-02 lands first with a minimal `TouchButton`, the Joy Pass refines the implementation (additive only; same prop API).
- **Font load delay:** `font-display: swap` (default for `@fontsource/*` variable CSS) -- text renders in fallback first; no layout shift larger than line-height boundary.
- **Audio coupling:** `useAudioFeedback` hook continues to fire on scan; `ScanSuccessFlash` is purely additive visual.
- **Offline font verification.** Manual smoke MUST include disconnecting the kiosk from the network and hard-reloading: Fraunces and Manrope must still render. If the build leaks any CDN font URL, the build is rejected. The `[MECHANICAL]` check `grep -r "fonts.googleapis.com" web/dist` enforces this at build time.
- **Reduced-motion verification.** Manual smoke MUST include enabling `prefers-reduced-motion: reduce` in DevTools and confirming the bloom/confetti/stamp keyframes are no-ops while the static states still render correctly.

## Out of Scope
- Wholesale visual redesign or palette change.
- Dark mode.
- Internationalization beyond English.
- Storybook or visual-regression infrastructure.
- New icon library beyond inline SVGs.
- Analytics / telemetry.
- Behavior changes beyond what Quick Wins SS-02 already specifies.
- Print-page (PDF export) styling changes.
- Mobile-first redesign (kiosks are 1024x768 minimum).

## Constraints

### Musts
- Stay inside existing `--color-hawk-*` and `--color-gold-*` tokens.
- Self-host fonts via `@fontsource/*`.
- Honor `prefers-reduced-motion` on every animation.
- Min hit target ≥56x56 CSS px on all primary actions.
- Pure additive change: every page opt-in.
- TypeScript with explicit prop types.

### Must-Nots
- No new color palette.
- No new CSS framework, no CSS-in-JS, no Storybook.
- No new animation library.
- No CDN fonts in production.
- No new icon library.
- No behavior changes outside what Quick Wins SS-02 already dictates.

### Preferences
- Prefer CSS keyframes over JS animation.
- Prefer inline SVGs over icon packages.
- Prefer matching demo copy verbatim where it fits.

### Escalation Triggers
- Lighthouse Performance regression > 3 points.
- Need for any new dependency beyond `@fontsource/*`.
- Aesthetic that cannot be matched within constraints.
- Existing page break.

## Verification

1. `cd web && npm run build` succeeds; production bundle is a static asset set ready for Docker `web` container.
2. Production build inspection: `grep -r "fonts.googleapis.com" web/dist || echo "OK"` returns "OK" (no CDN font URLs leaked into the bundle).
3. With `start.bat` running, open the kiosk in a browser:
   - `/station` -- Fraunces display heading, gold ribbon, stats card, four quick-action cards.
   - `/pickup` -- gold-trim input shell with mono scan input; SectionHeading on the page.
   - `/pickup/{orderId}` -- `TouchButton` on Complete Order; scanning a plant triggers `ScanSuccessFlash`; Complete Order triggers `OrderCompleteCelebration` then redirects to `/pickup` with focus on the search input.
4. With DevTools `prefers-reduced-motion: reduce` enabled, the bloom/confetti/stamp animations are disabled; static states still render.
5. Lighthouse run on `/station` shows Performance >= (baseline - 3).
6. Touchscreen smoke: on a 1024x768 viewport, every primary button is ≥56x56 CSS px and Complete Order is above-the-fold.

## Phase Specs

Refined by `/forge-prep` on 2026-04-25.

| Sub-Spec | Phase Spec |
|----------|------------|
| SS-01 Joy components + typography | `docs/specs/frontend-polish-joy-pass/sub-spec-1-joy-components.md` |

Index: `docs/specs/frontend-polish-joy-pass/index.md`
