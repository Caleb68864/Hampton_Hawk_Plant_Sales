---
type: phase-spec-index
master_spec: "docs/specs/2026-03-06-kiosk-mode-station-profiles.md"
date: 2026-03-06
sub_specs: 3
---

# Device-Local Kiosk Mode -- Phase Specs

Refined from [2026-03-06-kiosk-mode-station-profiles.md](../2026-03-06-kiosk-mode-station-profiles.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Device-Local Kiosk Session + Admin Authorization | none | [sub-spec-1-kiosk-session-admin-auth.md](sub-spec-1-kiosk-session-admin-auth.md) |
| 2 | Locked Kiosk Shell + Route Allowlist Enforcement | 1 | [sub-spec-2-kiosk-shell-route-guard.md](sub-spec-2-kiosk-shell-route-guard.md) |
| 3 | Station-Specific Pickup and Lookup/Print Experiences | 2 | [sub-spec-3-station-workflows.md](sub-spec-3-station-workflows.md) |

## Execution Order

```
Layer 0: Sub-spec 1
Layer 1: Sub-spec 2
Layer 2: Sub-spec 3
```

## Notes

- This refinement assumes kiosk mode is browser-local and intentionally not stored in `api/settings`.
- The first release covers only `Pickup` and `Lookup & Print` station profiles.
- `Walk-Up` is explicitly deferred until the current direct-load route crash is fixed and verified.

## Execution

Run `/forge-run docs/specs/kiosk-mode-station-profiles/` to execute all phase specs.
Run `/forge-run docs/specs/kiosk-mode-station-profiles/ --sub N` to execute a single sub-spec.
