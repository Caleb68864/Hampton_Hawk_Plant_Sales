# Joy Visual Parity Audit

**Date:** 2026-05-12  
**Auditor:** ___________  
**Reference:** `joy-pass-demo.html` (project root or design handoff directory)  
**Spec:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`

## Purpose

Verify that the implemented mobile shell matches the Joy visual language defined in `joy-pass-demo.html` across all target viewports and on real hardware where available.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ pass | Element renders correctly at this viewport |
| ❌ fail | Element is missing, broken, or mismatched; file a backlog issue |
| 🔶 blocked-no-device | Cannot verify — real device unavailable; responsive devtools used |
| ⬜ not-tested | Not yet audited |

## Parity Matrix

| Audit Element | 375px | 430px | 768px | 1024px | Real Phone | Real Tablet |
|--------------|-------|-------|-------|--------|------------|-------------|
| Header gradient + gold border | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Paper + grain background texture | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Fraunces display font (headings) | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Manrope body font | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Button treatments (primary/secondary) | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Scene cards (order card, result card) | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Scan input shell (camera + manual entry) | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Checkbloom success illustration | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Stamp / fulfilled indicator | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Seed empty-state illustration | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Connection-required scene | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |
| Access-denied scene | ⬜ | ⬜ | ⬜ | ⬜ | 🔶 blocked-no-device | 🔶 blocked-no-device |

> **Note on Real Phone / Real Tablet columns:** Mark `🔶 blocked-no-device` if no physical device was available during this audit pass. Describe what was verified via responsive devtools in the Notes section below instead of leaving the column blank. Do NOT record a pass without device or merged-stack evidence.

## Notes

_Record observations, regressions, or backlog issues here. One line per finding._

- Real phone and real tablet columns pre-filled as `blocked-no-device` (no device available at factory execution time). Responsive devtools at 375px, 430px, 768px, and 1024px should be used to populate those columns before sale day.
- If any cell is marked ❌ fail, file a backlog issue and record the issue ID in this table.

## Backlog Issues Filed

| Issue ID | Element | Viewport | Description |
|----------|---------|---------|-------------|
| — | — | — | None filed at this time |

_Auditor signature:_ ___________  
_Audit date:_ ___________
