---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 1
title: "Joy Mobile Theme Layer (tokens, typography, paper background)"
date: 2026-05-05
depends_on: []
---

# Sub-Spec 1: Joy Mobile Theme Layer (tokens, typography, paper background)

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Add the centralized mobile design layer that all `/mobile/*` routes inherit. Concretely:

- Create `web/src/styles/mobile-theme.css` and import it from `web/src/index.css`.
- Define `--mobile-*` aliases that resolve to existing tokens. Existing project state:
  - Brand palette `--color-hawk-*` and `--color-gold-*` and font tokens live in `web/src/index.css` under the Tailwind v4 `@theme` block.
  - Paper / ink / rule / plum / press tokens are currently defined in `web/src/styles/joy.css` as `--joy-paper`, `--joy-ink`, `--joy-rule`, `--joy-plum-shadow`, `--joy-press-shadow`. The mobile aliases must reference these (NOT redefine literals).
- Add a `MobilePageBackground` React component that renders a fixed-position background layer with two soft radial gradients and a dot-grain `::before` overlay (phone-tuned, smaller than the demo's tablet sizes).
- Provide reusable typography utility classes for: display H1, section title, body, eyebrow, monospace scan, tabular numerics. These live inside `mobile-theme.css` as plain CSS classes (Tailwind v4 utilities can layer on top, but the tokens themselves must be expressible without bespoke Tailwind config edits).
- Honor `prefers-reduced-motion: reduce` -- the background may shimmer/animate optionally; under reduced motion no animated gradient shifts are emitted.
- Produce evidence file `ss01-theme-evidence.md` documenting which existing token each `--mobile-*` alias resolves to.

This sub-spec produces the design layer only. No mobile routes are wired yet (SS-02 wires routes; SS-03 wires the layout shell that consumes the background component).

## Interface Contracts

### Provides

- CSS custom properties on `:root`:
  - `--mobile-surface` -> `var(--joy-paper)` (warm paper)
  - `--mobile-surface-elevated` -> `#ffffff` (white card surface used in `joy-pass-demo.html`)
  - `--mobile-rule` -> `var(--joy-rule)`
  - `--mobile-touch-min: 56px`
  - `--mobile-radius: 14px` (qa-card radius from demo)
- CSS utility classes (in `mobile-theme.css`):
  - `.mobile-display-h1` -- Fraunces, 36-40px @ 375px / 44-52px @ 430px / 64px @ tablet (>= 768px), italic-supporting via `<em>` child.
  - `.mobile-section-title` -- Fraunces 22-26px.
  - `.mobile-body` -- Manrope, font-size >= 16px.
  - `.mobile-eyebrow` -- Manrope 700, uppercase, letter-spacing 0.24-0.28em, 11px, color `var(--color-hawk-700)`.
  - `.mobile-mono-scan` -- monospace 20-24px, letter-spacing 0.08em.
  - `.mobile-tabular` -- `font-variant-numeric: tabular-nums`.
- Component `MobilePageBackground` (default-exported as named export `MobilePageBackground`):
  - Props: `{ children?: ReactNode; className?: string }`.
  - Renders a `<div>` with `data-mobile-bg` attribute, paper base, two radial gradients (~600px hawk-50 + gold-50 corners on phone, ~900px on tablet via media query at 768px), and a `::before` pseudo-element with 3-4% opacity dot-grain.
- Re-export from `web/src/components/mobile/index.ts` (create if missing) for tidy imports.

### Requires

- Existing tokens in `web/src/index.css` (`--color-hawk-*`, `--color-gold-*`, `--font-display`, `--font-body`).
- Existing tokens in `web/src/styles/joy.css` (`--joy-paper`, `--joy-ink`, `--joy-rule`, `--joy-plum-shadow`, `--joy-press-shadow`).
- `@fontsource/fraunces` and `@fontsource/manrope` already installed (confirmed in `web/package.json`).

### Shared State

None. CSS variables on `:root` are globally available; downstream sub-specs read but do not redefine.

## Implementation Steps

### Step 1: Write failing test
- **File:** `web/src/components/mobile/__tests__/MobilePageBackground.test.tsx`
- **Test name:** `MobilePageBackground renders without console errors and exposes data-mobile-bg`
- **Asserts:** component mounts, root element carries `data-mobile-bg` attribute, children render through, no console errors raised during render.
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobilePageBackground.test.tsx`
- **Expected:** test fails (component does not exist).
- **Note:** Project uses `node:test` via `node --test --experimental-strip-types` (see `web/package.json` `"test"` script). Vitest is NOT installed. If a worker tries `npx vitest`, it will fail and must fall back to `node:test`. Use Node's built-in `node:test` and a minimal JSDOM-style assertion via `react-dom/server` `renderToString` if no DOM is available, OR add a tiny test harness using `@testing-library/react` only if approved.

### Step 2: Create mobile-theme.css
- **File:** `web/src/styles/mobile-theme.css` (new)
- **Action:** create
- **Pattern:** Follow `web/src/styles/joy.css` (lives at `web/src/styles/`, imported from `web/src/index.css`).
- **Changes:**
  - Define `:root { --mobile-surface, --mobile-surface-elevated, --mobile-rule, --mobile-touch-min, --mobile-radius }` referencing existing tokens.
  - Add typography classes listed above.
  - Add `[data-mobile-bg]` selector with paper background, two radial gradients, and `[data-mobile-bg]::before` dot-grain overlay (3-4% opacity, 3px dot grid, mix-blend-mode multiply).
  - Add media query `@media (min-width: 768px)` to scale gradients to ~900px and bump display H1 to 64px.
  - Add `@media (prefers-reduced-motion: reduce)` to suppress any gradient/animation transitions.

### Step 3: Import from web/src/index.css
- **File:** `web/src/index.css`
- **Action:** modify
- **Changes:** Add `@import "./styles/mobile-theme.css";` after the existing `@import "./styles/print.css";` line.

### Step 4: Create MobilePageBackground component
- **File:** `web/src/components/mobile/MobilePageBackground.tsx` (new)
- **Action:** create
- **Pattern:** Follow component pattern in `web/src/components/shared/` (named-export functional components, `.tsx`, no default exports).
- **Changes:**
  - Functional component returning `<div data-mobile-bg className={className}>{children}</div>`.
  - No inline styles for colors -- all behavior carried by the `[data-mobile-bg]` CSS selector.
  - Type-safe `Props` interface.

### Step 5: Add barrel export
- **File:** `web/src/components/mobile/index.ts` (new)
- **Action:** create
- **Changes:** `export { MobilePageBackground } from './MobilePageBackground.js';`

### Step 6: Verify test passes
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobilePageBackground.test.tsx`
- **Expected:** test passes.

### Step 7: Verify build
- **Run:** `cd web && npm run build`
- **Expected:** exit code 0; no TypeScript errors; CSS compiles.

### Step 8: Write evidence file
- **File:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md`
- **Action:** create
- **Changes:** Table mapping each `--mobile-*` alias to the existing source token, plus typography scale documentation.

### Step 9: Commit
- **Stage:** `git add web/src/styles/mobile-theme.css web/src/index.css web/src/components/mobile/MobilePageBackground.tsx web/src/components/mobile/index.ts web/src/components/mobile/__tests__/MobilePageBackground.test.tsx docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md`
- **Message:** `feat: joy mobile theme layer (tokens, typography, paper background)`

## Tasks

- 1.1 -- Write failing test for MobilePageBackground
- 1.2 -- Create mobile-theme.css
- 1.3 -- Import mobile-theme.css from web/src/index.css
- 1.4 -- Create MobilePageBackground component
- 1.5 -- Add barrel export
- 1.6 -- Verify test passes
- 1.7 -- Verify build
- 1.8 -- Write ss01-theme-evidence.md

## Acceptance Criteria

- `[STRUCTURAL]` `web/src/styles/mobile-theme.css` defines `--mobile-surface`, `--mobile-surface-elevated`, `--mobile-rule`, `--mobile-touch-min: 56px`, `--mobile-radius` and is imported from `web/src/index.css`.
- `[STRUCTURAL]` All mobile aliases reference existing tokens (e.g., `--mobile-surface: var(--joy-paper);`); no parallel hex/rgb literals are introduced for color values that already exist in the desktop palette.
- `[STRUCTURAL]` `MobilePageBackground` renders the paper base with two soft radial gradients (~600px hawk-50 + gold-50 corners on phone, ~900px on tablet) and the 3-4% opacity dot-grain overlay via a `::before` pseudo-element.
- `[STRUCTURAL]` Typography utilities exist for: display H1 (Fraunces, 36-40px @ 375px / 44-52px @ 430px / 64px @ tablet), section title (Fraunces 22-26px), body (Manrope >= 16px), eyebrow (Manrope 700 uppercase, .24-.28em letter-spacing, 11px, hawk-700), monospace scan (20-24px, .08em letter-spacing).
- `[STRUCTURAL]` Numeric utility class applies `font-variant-numeric: tabular-nums`.
- `[BEHAVIORAL]` `MobilePageBackground` renders without console errors and respects `prefers-reduced-motion` (no animated gradient shifts).
- `[MECHANICAL]` `cd web && npm run build` exits 0.
- `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobilePageBackground.test.tsx` exits 0. (Spec text says `npx vitest`; project uses `node --test`. See evidence file for the framework substitution rationale.)
- `[STRUCTURAL]` `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md` exists and documents which existing tokens each `--mobile-*` alias resolves to.

## Completeness Checklist

CSS variables added to `:root` in `mobile-theme.css`:

| Variable | Type | Required | Resolves To |
|---------|------|----------|-------------|
| `--mobile-surface` | color | required | `var(--joy-paper)` (#fbf7ee) |
| `--mobile-surface-elevated` | color | required | `#ffffff` (matches qa-card surface in joy demo) |
| `--mobile-rule` | color | required | `var(--joy-rule)` |
| `--mobile-touch-min` | length | required | `56px` |
| `--mobile-radius` | length | required | `14px` |

Typography classes:

| Class | Family | Phone Size | Tablet Size | Other |
|-------|--------|------------|-------------|-------|
| `.mobile-display-h1` | Fraunces | 36-40px @375 / 44-52px @430 | 64px | italic via `<em>` |
| `.mobile-section-title` | Fraunces | 22-26px | 22-26px | -- |
| `.mobile-body` | Manrope | >= 16px | >= 16px | line-height ~1.5 |
| `.mobile-eyebrow` | Manrope 700 | 11px | 11px | letter-spacing 0.24-0.28em, uppercase, color hawk-700 |
| `.mobile-mono-scan` | mono | 20-24px | 20-24px | letter-spacing 0.08em |
| `.mobile-tabular` | inherit | inherit | inherit | `font-variant-numeric: tabular-nums` |

Resource limits / numeric boundaries:
- Touch target minimum: 56px -- enforced via `--mobile-touch-min`, applied by all mobile button components in SS-04.
- Dot-grain overlay opacity: 3-4% -- enforced in `[data-mobile-bg]::before`.
- Tablet breakpoint: 768px -- enforced via `@media (min-width: 768px)`.

## Verification Commands

- **Build:** `cd web && npm run build`
- **Tests:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobilePageBackground.test.tsx`
- **Acceptance:** Manually inspect compiled CSS in `web/dist/` for `--mobile-*` declarations. Open `index.html` of build and confirm `data-mobile-bg` element shows paper background with grain overlay.

## Patterns to Follow

- `web/src/styles/joy.css`: Pattern for adding additional global CSS file imported by `web/src/index.css`. Use `:root` selector for variable declarations and component-scoped class selectors for utilities.
- `web/src/components/shared/`: Component file pattern -- named export, `.tsx` extension, sibling `.test.tsx` in `__tests__/` (note: most existing components use `.test.ts` colocated, but newer test directories use `__tests__/`; mobile sub-specs adopt `__tests__/`).

## Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/styles/mobile-theme.css` | Create | Mobile design tokens, typography, paper background CSS |
| `web/src/index.css` | Modify | Add `@import "./styles/mobile-theme.css";` |
| `web/src/components/mobile/MobilePageBackground.tsx` | Create | React wrapper for paper background + grain |
| `web/src/components/mobile/index.ts` | Create | Barrel export |
| `web/src/components/mobile/__tests__/MobilePageBackground.test.tsx` | Create | Render test |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md` | Create | Token-mapping evidence |
