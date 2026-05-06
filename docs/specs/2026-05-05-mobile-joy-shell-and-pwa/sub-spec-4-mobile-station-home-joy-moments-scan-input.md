---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 4
title: "Mobile Station Home, Quick-Action Cards, Joy Moments, Scan Input Shell"
date: 2026-05-05
depends_on: ["SS-01", "SS-02", "SS-03"]
---

# Sub-Spec 4: Mobile Station Home, Joy Moments, Scan Input Shell

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Flesh out `MobileHomePage` with the Joy greeting (Fraunces with gold-italic emphasis), a tabular-num quantity ribbon, role-aware quick-action cards using the `qa-card` pattern (left-edge gold->purple gradient bar that fills 0->full on press), the Joy moment components (`Checkbloom`, `Stamp`, `Seed`), the `ScanInputShell`, and the three button variants (`MobilePrimaryButton`, `MobileGoldButton`, `MobileGhostButton`). Plus a single `JoyAriaLive` region rendered at layout level.

Codebase findings:
- `web/src/styles/joy.css` already defines `--joy-paper`, `--joy-ink`, `--joy-rule`, `--joy-plum-shadow`, `--joy-press-shadow`, the `pop` and `ring` keyframes for Checkbloom, and a `.paper-grain` utility. Reuse these.
- `joy-pass-demo.html` contains the canonical `.qa-card` (`::before` left bar, hover `scaleY(1)`), `.scan-input-shell` (gold border + paper-to-gold-50 inset), and three button gradients.
- No `Checkbloom`/`Stamp`/`Seed` components currently exist anywhere in `web/src`.
- No mobile button variants exist; `web/src/components/shared/TouchButton.tsx` is the closest relative -- but a fresh mobile button family is required because the gradients/shadows differ.

## Interface Contracts

### Provides

- `MobilePrimaryButton(props)`:
  - Props: `{ children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; fullWidth?: boolean; ariaLabel?: string }`.
  - Linear-gradient `--color-hawk-600` -> `--color-hawk-800`, white text, 12px radius, `min-height: var(--mobile-touch-min)` (56px), gold-tinted plum shadow `0 8px 22px -10px rgba(212,160,33,0.45)`, `:active` translateY(1px). Phone full-width default; `fullWidth={false}` triggers auto-width on tablet.
- `MobileGoldButton(props)`: same prop shape; gradient `--color-gold-300` -> `--color-gold-500`, text `--color-hawk-950`.
- `MobileGhostButton(props)`: same prop shape; white surface, 1px `--color-hawk-200` border, text `--color-hawk-800`.
- `MobileQuickActionCard(props)`:
  - Props: `{ id: string; icon: ReactNode; title: string; description?: string; to?: string; enabled: boolean; onClick?: () => void; ariaLabel?: string }`.
  - 14px radius, white surface, 40x40 hawk-50 icon tile (10px radius), Fraunces 18px title, Manrope 13px description (#6b5573).
  - Left-edge gradient bar (`::before`) gold->purple that scales 0->1 vertically on `:active` over 200ms.
  - Disabled cards: opacity 0.55, no press feedback, `aria-disabled="true"`, `tabIndex=-1`.
- `MobileGreeting(props)`: `{ user: CurrentUser | null; timeOfDay?: 'morning' | 'afternoon' | 'evening' }`. Renders Fraunces "Good *morning*, Caleb" with gold italic on the emphasis word.
- `MobileStatsRibbon(props)`: `{ stats: { label: string; value: number | string }[] }`. Renders horizontal flex of stats with `.mobile-tabular` numerics.
- `Checkbloom(props)`: `{ message?: string; onComplete?: () => void }`. 120px gold radial badge, animated check SVG (`pop 480ms`), expanding ring (`ring 700ms`). Calls into `JoyAriaLive` on mount with `message`. Reduced-motion: final-state badge, static ring.
- `Stamp(props)`: `{ label: string }`. Rotated dashed gold-600 border, Fraunces italic, 26px phone / 32px tablet. Reduced-motion: un-rotated, static.
- `Seed(props)`: `{ tone?: 'gold' | 'hawk' }`. 64-80px asymmetric gold (or hawk-tinted) shape with rotation + shadow. Used for empty/blocked states.
- `JoyAriaLive`:
  - Renders a single `<div role="status" aria-live="polite" aria-atomic="true">` once.
  - Exports a `useJoyAnnounce()` hook returning `(message: string) => void` that updates the live region.
  - Implementation: React Context provider used by MobileLayout (modify SS-03 layout to mount `JoyAriaLiveProvider`).
- `ScanInputShell(props)`: `{ label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }`.
  - 2px `--color-gold-300` outer border, `linear-gradient(var(--joy-paper), var(--color-gold-50))` inset, white inner field with 1px `var(--mobile-rule)` border.
  - Monospace 20-24px content, eyebrow label slot above, hint slot below, focus ring `2px solid var(--color-gold-500)` + `0 0 0 4px rgba(212,160,33,.18)`.

Updated `MobileHomePage` consumes `getMobileWorkflows(currentUser)` and renders:
- Phone (default): single column with greeting + ribbon + workflow cards stacked.
- Tablet (>= 768px): two-column grid -- greeting + ribbon + primary CTA on left; stats + quick-actions on right.
- No print control, link, or icon ANYWHERE in the rendered tree.
- All interactive controls have effective tap target >= 44 CSS px.

### Requires

- From SS-01: `--mobile-*` aliases, `MobilePageBackground`, typography classes.
- From SS-02: `getMobileWorkflows`, `MobileWorkflowEntry`.
- From SS-03: `MobileLayout` (mounts `JoyAriaLiveProvider`), `useAuthStore.currentUser`.
- `web/src/styles/joy.css` keyframes `pop`, `ring`.

### Shared State

- `JoyAriaLive` Context provided by `MobileLayout` (SS-03 modification: wrap children in `<JoyAriaLiveProvider>`). Consumed by `Checkbloom` and any future joy moment.

## Implementation Steps

### Step 1: Write failing tests
- **Files:**
  - `web/src/components/mobile/__tests__/MobileQuickActionCard.test.tsx`
    - Renders title and description.
    - When `enabled === false`, has `aria-disabled="true"` and click handler is not invoked.
    - Renders 40x40 icon tile.
  - `web/src/components/mobile/__tests__/Checkbloom.test.tsx`
    - Renders within 120px box.
    - Calls `useJoyAnnounce` with provided message on mount.
    - Reduced-motion media query renders final state without animation classes.
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileQuickActionCard.test.tsx src/components/mobile/__tests__/Checkbloom.test.tsx`
- **Expected:** all fail.

### Step 2: Implement button variants
- **Files:** `web/src/components/mobile/buttons/MobilePrimaryButton.tsx`, `MobileGoldButton.tsx`, `MobileGhostButton.tsx`
- **Pattern:** `web/src/components/shared/TouchButton.tsx` (existing button shape -- props pass-through, named export). Do not import; build fresh.

### Step 3: Implement JoyAriaLive
- **File:** `web/src/components/mobile/joy/JoyAriaLive.tsx`
- **Changes:** React Context with provider + `useJoyAnnounce` hook. Renders one polite live region with rotating message via `useState`.

### Step 4: Implement Checkbloom, Stamp, Seed
- **Files:** `web/src/components/mobile/joy/Checkbloom.tsx`, `Stamp.tsx`, `Seed.tsx`
- **Pattern:** Reuse keyframes from `web/src/styles/joy.css` (`pop`, `ring`). Add new keyframes only if missing.
- **Changes:** Functional components with prefers-reduced-motion fallbacks (use CSS `@media (prefers-reduced-motion: reduce)` selectors on the component's class names).

### Step 5: Implement ScanInputShell
- **File:** `web/src/components/mobile/ScanInputShell.tsx`
- **Pattern:** Mirror `joy-pass-demo.html` `.scan-input-shell` rule.

### Step 6: Implement MobileQuickActionCard
- **File:** `web/src/components/mobile/MobileQuickActionCard.tsx`
- **Pattern:** Mirror `joy-pass-demo.html` `.qa-card` rule with `::before` bar.

### Step 7: Implement MobileGreeting and MobileStatsRibbon
- **Files:** `web/src/components/mobile/MobileGreeting.tsx`, `web/src/components/mobile/MobileStatsRibbon.tsx`
- **Changes:** Greeting computes time-of-day from `new Date().getHours()` if prop omitted. Stats ribbon flex-row with `.mobile-tabular`.

### Step 8: Modify MobileLayout to mount JoyAriaLiveProvider
- **File:** `web/src/layouts/MobileLayout.tsx` (modify from SS-03)
- **Changes:** Wrap layout body in `<JoyAriaLiveProvider>`.

### Step 9: Modify MobileHomePage
- **File:** `web/src/pages/mobile/MobileHomePage.tsx` (modify from SS-02)
- **Changes:**
  - Read `currentUser` and `workflows = getMobileWorkflows(currentUser)`.
  - Render `MobileGreeting`, `MobileStatsRibbon` (placeholder stats: zero-valued for now, real data in later specs), then a list of `MobileQuickActionCard` per workflow (cards from `enabled: false` entries render disabled).
  - At >= 768px, two-column grid. Use a Tailwind class `lg:grid lg:grid-cols-2` or CSS via `mobile-theme.css`.
  - Verify nothing in tree imports any `Print*` component.

### Step 10: Verify tests pass
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileQuickActionCard.test.tsx src/components/mobile/__tests__/Checkbloom.test.tsx`
- **Expected:** pass.

### Step 11: Verify build
- **Run:** `cd web && npm run build`
- **Expected:** exit 0.

### Step 12: Capture home evidence
- **File:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss04-home-evidence.md` (new)
- **Action:** Side-by-side screenshots at 375px and 430px against `docs/plans/joy-pass-demo.html`. Note matched/mismatched items.

### Step 13: Commit
- **Stage:** `git add web/src/components/mobile/MobileQuickActionCard.tsx web/src/components/mobile/MobileGreeting.tsx web/src/components/mobile/MobileStatsRibbon.tsx web/src/components/mobile/joy/ web/src/components/mobile/ScanInputShell.tsx web/src/components/mobile/buttons/ web/src/components/mobile/__tests__/MobileQuickActionCard.test.tsx web/src/components/mobile/__tests__/Checkbloom.test.tsx web/src/pages/mobile/MobileHomePage.tsx web/src/layouts/MobileLayout.tsx docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss04-home-evidence.md`
- **Message:** `feat: mobile station home, joy moments, scan input shell`

## Tasks

- 4.1 -- Write failing tests for MobileQuickActionCard and Checkbloom
- 4.2 -- Implement button variants (Primary, Gold, Ghost)
- 4.3 -- Implement JoyAriaLive provider + hook
- 4.4 -- Implement Checkbloom, Stamp, Seed
- 4.5 -- Implement ScanInputShell
- 4.6 -- Implement MobileQuickActionCard
- 4.7 -- Implement MobileGreeting and MobileStatsRibbon
- 4.8 -- Modify MobileLayout to mount JoyAriaLiveProvider
- 4.9 -- Modify MobileHomePage to compose the home grid
- 4.10 -- Verify tests pass
- 4.11 -- Verify build
- 4.12 -- Capture ss04-home-evidence.md

## Acceptance Criteria

- `[STRUCTURAL]` Quick-action cards use 14px radius, white surface on paper, a 40x40 hawk-50 icon tile, Fraunces 18px title, Manrope 13px description (#6b5573).
- `[STRUCTURAL]` Quick-action cards have a left-edge gold->purple gradient bar that scales from 0 to full height on `:active` over 200ms; under `prefers-reduced-motion`, the bar appears at full height without animation.
- `[STRUCTURAL]` Disabled "coming soon" quick-action cards render at 0.55 opacity, do not respond to press, and have `aria-disabled="true"`.
- `[STRUCTURAL]` `Checkbloom` renders a 120px gold radial badge with check SVG + expanding ring; animations match the demo's `pop 480ms` and `ring 700ms`. Reduced-motion users see the badge at final scale with a static ring.
- `[STRUCTURAL]` `Stamp` is a rotated dashed gold-600 border with Fraunces italic; phone font-size ~26px, tablet ~32px; reduced-motion variant appears un-rotated and static.
- `[STRUCTURAL]` `Seed` is a 64-80px asymmetric gold shape with rotation/shadow used for empty states; reduced-motion variant is static.
- `[STRUCTURAL]` `ScanInputShell` matches `.scan-input-shell` / `.scan-input`: 2px gold-300 outer border, paper-to-gold-50 inset, white inner field with 1px `--mobile-rule` border, monospace 20-24px content, eyebrow label slot above, hint slot below, focus ring of gold-500 border + 4px gold-500 alpha glow `0 0 0 4px rgba(212,160,33,.18)`.
- `[STRUCTURAL]` `MobilePrimaryButton` uses linear-gradient hawk-600 -> hawk-800, white text, 12px radius, min-height `var(--mobile-touch-min)` (56px), gold-tinted plum shadow, and translates 1px on `:active`. Phone full-width, tablet auto-width.
- `[STRUCTURAL]` `MobileGoldButton` uses gold-300 -> gold-500 gradient with hawk-950 text. `MobileGhostButton` uses white surface, 1px hawk-200 border, hawk-800 text.
- `[BEHAVIORAL]` `MobileHomePage` renders the signed-in username/station identity, the connection status dot from SS-03, and only role-allowed quick-action cards from `getMobileWorkflows(user)`.
- `[BEHAVIORAL]` `MobileHomePage` never renders any print control, print link, or print icon anywhere in its tree.
- `[STRUCTURAL]` At viewport >= 768px, `MobileHomePage` uses a two-column grid: greeting + ribbon + primary CTA on left, stats + quick-actions on right.
- `[STRUCTURAL]` `JoyAriaLive` is rendered once at the layout level and exposes a function/context to announce joy moments (e.g., "Coleus 'Wizard Mix' accepted, 3 remaining"). At least `Checkbloom` calls into it on mount.
- `[BEHAVIORAL]` All interactive controls on `MobileHomePage` have a tap target >= 44 CSS px even when visually styled smaller.
- `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileQuickActionCard.test.tsx src/components/mobile/__tests__/Checkbloom.test.tsx` exits 0.
- `[HUMAN REVIEW]` Side-by-side at 375px and 430px against `docs/plans/joy-pass-demo.html`, the home reads as the demo translated to mobile. Screenshots saved to `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss04-home-evidence.md`.
- `[MECHANICAL]` `cd web && npm run build` exits 0.

## Completeness Checklist

`MobileQuickActionCard` props:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `id` | `string` | required | React key |
| `icon` | `ReactNode` | required | left tile |
| `title` | `string` | required | Fraunces 18px label |
| `description` | `string` | optional | Manrope 13px line |
| `to` | `string` | optional | router target if enabled |
| `enabled` | `boolean` | required | press behavior + opacity |
| `onClick` | `() => void` | optional | alternative to `to` |
| `ariaLabel` | `string` | optional | a11y override |

`Checkbloom` props:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `message` | `string` | optional | passed to `useJoyAnnounce` on mount |
| `onComplete` | `() => void` | optional | fires after final keyframe (or immediately under reduced-motion) |

`ScanInputShell` props:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `label` | `string` | required | eyebrow above field |
| `hint` | `string` | optional | hint below field |
| `value` | `string` | required | controlled input |
| `onChange` | `(v: string) => void` | required | input change |
| `placeholder` | `string` | optional | placeholder text |
| `ariaLabel` | `string` | optional | a11y override |

Resource limits / numeric boundaries:
- Quick-action card radius: 14px (matches `--mobile-radius`).
- Icon tile: 40x40 px, 10px radius.
- Title size: 18px Fraunces.
- Description: 13px Manrope.
- Disabled opacity: 0.55.
- Press bar transition: 200ms.
- Checkbloom diameter: 120px; pop 480ms; ring 700ms.
- Stamp font-size: 26px phone / 32px tablet.
- Seed size: 64-80px.
- Mobile button min-height: 56px (`--mobile-touch-min`).
- Mobile button radius: 12px.
- Scan input outer border: 2px gold-300; focus ring: 4px gold-500 alpha 0.18.
- Tap target minimum: 44 CSS px (W3C/WCAG conformance).
- Tablet two-column breakpoint: 768px.

## Verification Commands

- **Build:** `cd web && npm run build`
- **Tests:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileQuickActionCard.test.tsx src/components/mobile/__tests__/Checkbloom.test.tsx`
- **Acceptance:**
  - DevTools: search rendered DOM at `/mobile` for `Print` substring -- must be zero matches.
  - DevTools 375px: greeting visible, ribbon visible, role-relevant cards visible (single column).
  - DevTools 768px: greeting+ribbon left, cards right (two-column).
  - DevTools "prefers-reduced-motion: reduce": navigate, mount Checkbloom -- no animated transitions.

## Patterns to Follow

- `joy-pass-demo.html` `.qa-card`, `.scan-input-shell`, button gradients -- canonical visual reference.
- `web/src/styles/joy.css` `pop` and `ring` keyframes -- reuse, do not redefine.
- `web/src/components/shared/TouchButton.tsx` -- prop shape pattern for button components (do not import).

## Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/components/mobile/buttons/MobilePrimaryButton.tsx` | Create | Hawk gradient primary button |
| `web/src/components/mobile/buttons/MobileGoldButton.tsx` | Create | Gold gradient button |
| `web/src/components/mobile/buttons/MobileGhostButton.tsx` | Create | White ghost button |
| `web/src/components/mobile/joy/JoyAriaLive.tsx` | Create | Single ARIA live region + provider/hook |
| `web/src/components/mobile/joy/Checkbloom.tsx` | Create | Scan-accepted badge |
| `web/src/components/mobile/joy/Stamp.tsx` | Create | Order-complete stamp |
| `web/src/components/mobile/joy/Seed.tsx` | Create | Empty/blocked-state shape |
| `web/src/components/mobile/ScanInputShell.tsx` | Create | Reusable scan input wrapper |
| `web/src/components/mobile/MobileQuickActionCard.tsx` | Create | qa-card with press bar |
| `web/src/components/mobile/MobileGreeting.tsx` | Create | "Good *morning*, Caleb" greeting |
| `web/src/components/mobile/MobileStatsRibbon.tsx` | Create | Tabular-num quantity strip |
| `web/src/components/mobile/__tests__/MobileQuickActionCard.test.tsx` | Create | Unit tests |
| `web/src/components/mobile/__tests__/Checkbloom.test.tsx` | Create | Unit tests |
| `web/src/pages/mobile/MobileHomePage.tsx` | Modify | Replace placeholder with full home |
| `web/src/layouts/MobileLayout.tsx` | Modify | Wrap children in `JoyAriaLiveProvider` |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss04-home-evidence.md` | Create | Side-by-side screenshots |
