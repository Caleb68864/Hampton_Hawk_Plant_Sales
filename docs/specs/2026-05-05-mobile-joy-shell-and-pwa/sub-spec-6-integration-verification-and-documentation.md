---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 6
title: "Integration Wiring, Verification, and Documentation"
date: 2026-05-05
depends_on: ["SS-01", "SS-02", "SS-03", "SS-04", "SS-05"]
---

# Sub-Spec 6: Integration, Verification, and Documentation

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Confirm the entire mobile shell wires together end-to-end. Add README/docs notes that mobile is online-only and non-printing. Produce the test plan and viewport screenshots used by sale-day readiness. Confirm desktop and kiosk regression. This sub-spec exists to enforce the integration contract -- it does not introduce new components.

Codebase findings:
- `README.md` exists at repo root (`C:\Users\CalebBennett\Documents\GitHub\Hampton_Hawk_Plant_Sales\README.md`).
- `docs/cheatsheets/admin.md` does NOT exist (per Glob -- skip if absent).
- API solution file: `api/HamptonHawksPlantSales.sln`.
- `CLAUDE.md` already has architecture rules; only modify if a new permanent rule emerges.

## Interface Contracts

### Provides

- `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` -- enumerates the smoke path used by the sale-day readiness plan.
- `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` -- 375/430/768/1024 screenshots embedded with captions.
- `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md` -- the integration evidence document referencing all prior evidence files (ss01..ss05) and visual review pairs against `docs/plans/joy-pass-demo.html`.
- `README.md` updated with a Mobile section.

### Requires

- All of SS-01..SS-05 merged.
- A working backend instance for live integration checks.
- At least one user account per role to exercise role-aware behavior (`Admin`, `Pickup`, `LookupPrint`, `POS`).

### Shared State

- Reads everything; writes only documentation.

## Implementation Steps

### Step 1: Smoke-test the integration matrix
- Manually exercise each `[INTEGRATION]` acceptance criterion from the master spec section 6:
  - `/mobile` as Pickup -> home with pickup card; no print controls.
  - `/mobile` as POS-only -> access-denied scene; no drawer.
  - `/mobile` unauthenticated -> `/login` -> back to `/mobile`.
  - DevTools `navigator.onLine = false` -> connection-required scene swaps in; restore -> home returns.
  - Stop backend -> backend-unavailable scene; start backend -> home returns.
  - Visit `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk routes -> desktop/kiosk layouts unchanged.

### Step 2: Reduced-motion + ARIA verification
- Apply DevTools `prefers-reduced-motion: reduce` and confirm Checkbloom/Stamp/Seed/page-transitions/qa-card press bar render statically without breaking layout.
- Watch DevTools "Live regions" panel during auth changes, connection changes, and `Checkbloom` mount -- confirm announcements via `JoyAriaLive`.

### Step 3: Capture viewport screenshots
- **File:** `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` (new)
- **Action:** Capture and embed:
  - 375px: home single-column, drawer overlay, scene swap.
  - 430px: home single-column, drawer.
  - 768px: home two-column, permanent rail, no hamburger.
  - 1024px: home two-column, permanent rail.
  - Desktop regression: `/pickup`, `/lookup-print`, `/orders`, `/reports` rendered in their existing layouts.

### Step 4: Write test plan
- **File:** `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` (new)
- **Action:** Enumerate the smoke path used by the sale-day readiness plan: open `/mobile` -> auth -> verify account visible -> verify connection visible -> verify role-allowed cards -> verify no print -> simulate offline -> verify desktop unaffected.

### Step 5: Update README
- **File:** `README.md` (modify)
- **Action:** Add a "Mobile" section documenting:
  - Mobile lives under `/mobile/*`.
  - Mobile is online-only.
  - Mobile has no print workflow.
  - Mobile installs via PWA manifest with `start_url: /mobile`.
  - Camera scanning will require HTTPS in a future spec.

### Step 6: Update docs/cheatsheets/admin.md if it exists
- **File:** `docs/cheatsheets/admin.md`
- **Action:** ONLY if file exists, append a section "Mobile install" with quick steps. Otherwise skip.

### Step 7: Decide whether to update CLAUDE.md
- **File:** `CLAUDE.md`
- **Action:** ONLY if the integration produced a new permanent architectural rule that future agents must follow (e.g., "mobile lives under `/mobile/*`, no print"). Otherwise leave untouched.

### Step 8: Visual review pairs
- **File:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md` (new)
- **Action:** Document screenshot-pair comparisons against `docs/plans/joy-pass-demo.html` (header gradient, paper + grain, Fraunces/Manrope, button treatments, scene cards, eyebrow labels, focus ring colors). Mark each as "matches demo" or "deviates" with rationale.

### Step 9: Final builds
- **Run web:** `cd web && npm run build`
- **Run api:** `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet`
- **Expected:** both exit 0.

### Step 10: Commit
- **Stage:** `git add docs/tests/2026-05-05-mobile-joy-shell-and-pwa/ docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md README.md`
- **Message:** `docs: mobile shell integration evidence, test plan, and readme updates`

## Tasks

- 6.1 -- Smoke-test integration matrix (Pickup/POS/unauth/offline/backend-down/desktop)
- 6.2 -- Reduced-motion and ARIA live region verification
- 6.3 -- Capture viewport screenshots (375/430/768/1024 + desktop regression)
- 6.4 -- Write test-plan.md
- 6.5 -- Update README.md with Mobile section
- 6.6 -- Update docs/cheatsheets/admin.md if exists
- 6.7 -- Decide CLAUDE.md update
- 6.8 -- Write ss06-integration-evidence.md (visual review pairs)
- 6.9 -- Final web and api builds

## Acceptance Criteria

- `[INTEGRATION]` Opening `/mobile` while authenticated with the `Pickup` role renders `MobileLayout` -> `MobileHomePage` with the pickup quick-action card visible and no print controls anywhere in the rendered tree.
- `[INTEGRATION]` Opening `/mobile` while authenticated with `POS`-only role renders `MobileAccessDeniedScene` with account identity and sign-out, and does not render the drawer or any workflow card.
- `[INTEGRATION]` Opening `/mobile` while unauthenticated routes through the shared `/login`, and after success returns to `/mobile`.
- `[INTEGRATION]` Toggling browser offline (`navigator.onLine = false`) on `/mobile` swaps to `MobileConnectionRequiredScene`; toggling back online restores `MobileHomePage` without a manual reload.
- `[INTEGRATION]` Stopping the backend API while keeping the browser online causes `MobileBackendUnavailableScene` to render with a working retry; restoring the API restores the home.
- `[INTEGRATION]` Visiting `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, and kiosk routes still renders desktop/kiosk layouts unchanged (regression check captured in viewport-checks.md).
- `[BEHAVIORAL]` `prefers-reduced-motion: reduce` applied via DevTools causes `Checkbloom`, `Stamp`, `Seed`, page transitions, and the qa-card press bar to render statically without breaking layout.
- `[BEHAVIORAL]` `JoyAriaLive` announces auth state changes, connection state changes, and joy moments via an `aria-live="polite"` region.
- `[STRUCTURAL]` `README.md` documents: mobile lives under `/mobile/*`, mobile is online-only, mobile has no print workflow, mobile installs via PWA manifest with `start_url: /mobile`, camera scanning will require HTTPS in a future spec.
- `[STRUCTURAL]` `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` enumerates the smoke path used by sale-day readiness.
- `[STRUCTURAL]` `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` contains screenshot evidence at 375px, 430px, 768px, 1024px showing no overlap and correct phone-vs-tablet treatment.
- `[STRUCTURAL]` Visual parity against `docs/plans/joy-pass-demo.html` is verified by the explicit checklist defined in master spec SS-06 AC-12 (header gradient, paper bg, Fraunces, Manrope, button treatments, scene cards, eyebrow labels, focus ring, Seed, page transitions). Each row marked PASS/FAIL with screenshot-pair link in `ss06-integration-evidence.md`; any FAIL row links to a follow-up issue or is approved by a named designer reviewer recorded in the evidence file. Predicates use exact hex/CSS-value comparisons against tokens, not subjective judgment.
- `[MECHANICAL]` `cd web && npm run build` exits 0.
- `[MECHANICAL]` `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` exits 0.

## Completeness Checklist

Required documentation deliverables:

| File | Required Content |
|------|------------------|
| `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` | smoke path: open /mobile -> auth -> account visible -> connection visible -> role cards -> no print -> simulate offline -> desktop unaffected |
| `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` | 375/430/768/1024 screenshots + desktop regression captures |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md` | screenshot pairs vs joy-pass-demo.html with match/deviation notes |
| `README.md` Mobile section | online-only / no-print / `/mobile/*` / PWA `start_url: /mobile` / future HTTPS for camera |

Resource limits / numeric boundaries:
- Viewport checkpoints: 375px, 430px, 768px, 1024px (master spec verification list).

## Verification Commands

- **Build:** `cd web && npm run build && cd ../api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet`
- **Tests:** `cd web && npm test` (runs the existing node:test suite; mobile tests are added to or invoked alongside this list).
- **Acceptance:** Walk through each `[INTEGRATION]` criterion manually with browser and DevTools as described in Step 1 and Step 2.

## Patterns to Follow

- All prior sub-specs' evidence files for documentation tone.
- `README.md` existing section structure.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` | Create | Smoke test plan for sale-day readiness |
| `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` | Create | Viewport screenshot evidence |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md` | Create | Integration evidence + visual review pairs |
| `README.md` | Modify | Add Mobile section |
| `docs/cheatsheets/admin.md` | Modify (if exists) | Mobile install quick steps |
| `CLAUDE.md` | Modify (only if rule emerges) | New permanent architectural rule |
