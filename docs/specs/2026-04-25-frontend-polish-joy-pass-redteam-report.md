# Red Team Review: Frontend Polish -- Joy Pass

Date: 2026-04-25
Reviewed: `docs/specs/2026-04-25-frontend-polish-joy-pass.md`
Phase specs: `docs/specs/frontend-polish-joy-pass/` (1 sub-spec)

## Severity Summary
- CRITICAL: 0
- ADVISORY: 1 (auto-patched into the spec)

## Role Scorecards
Developer: 0 | QA: 1 | End User: 0 | Architect: 0 | Scope Realist: 0 | Security: 0 | SRE: 0 | Data: 0 | Product: 0

## CRITICAL Findings
None. Spec is tightly scoped, additive, with a working visual reference.

## ADVISORY Findings (patched)

### A-1: Offline + reduced-motion verification (QA)
- **Location:** Edge Cases / Verification.
- **Issue:** The spec mentions offline-first and `prefers-reduced-motion` as goals but does not require a manual smoke step to verify them.
- **Fix applied:** Added two explicit Edge Case entries calling for offline reload and reduced-motion DevTools emulation as part of manual smoke. `[MECHANICAL]` check on the build for CDN font leakage already exists in the phase spec.

## Notes (Not Patched)
- **Lighthouse baseline:** "no more than 3 points" requires a baseline measurement before merging. Recommend running Lighthouse on `/station` and `/pickup` against `main` HEAD before opening the polish PR. Document the baseline in the PR description.
- **TouchButton coordination:** Quick Wins SS-02 references `TouchButton` as a shared component. If the Joy Pass PR lands first, SS-02 just imports it; if SS-02 lands first with a minimal version, Joy Pass is additive. Both paths are documented; nothing to patch here.
- **Motion library deferred:** No need for Motion / Framer Motion. CSS keyframes are sufficient for the demo's animation surface.
