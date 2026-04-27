---
type: phase-spec-index
master_spec: "../2026-04-25-walkup-cash-register-rewrite.md"
date: 2026-04-25
sub_specs: 4
---

# Walk-Up Cash Register Rewrite -- Phase Specs

Refined from [2026-04-25-walkup-cash-register-rewrite.md](../2026-04-25-walkup-cash-register-rewrite.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| SS-01 | Schema additions -- OrderStatus.Draft, nullable CustomerId, payment metadata | none | [sub-spec-1-schema-additions.md](sub-spec-1-schema-additions.md) |
| SS-02 | WalkUpRegisterService -- backend | SS-01 | [sub-spec-2-walkup-register-service.md](sub-spec-2-walkup-register-service.md) |
| SS-03 | WalkUpRegisterPage -- frontend | SS-02 | [sub-spec-3-walkup-register-page.md](sub-spec-3-walkup-register-page.md) |
| SS-04 | Coexistence with legacy walk-up + station home updates | SS-03 | [sub-spec-4-legacy-coexistence.md](sub-spec-4-legacy-coexistence.md) |

## Wave Plan
- Wave 1: SS-01.
- Wave 2: SS-02.
- Wave 3: SS-03.
- Wave 4: SS-04.

This is a fully serial chain because schema additions block service work, and the page depends on the service contract.

## Requirement Traceability Matrix

| Requirement | Covered By |
|-------------|-----------|
| R1 (OrderStatus.Draft + report exclusion) | SS-01 |
| R2 (nullable CustomerId for walk-up) | SS-01 |
| R3 (payment metadata columns) | SS-01 |
| R4 (IWalkUpRegisterService 7 methods) | SS-02 |
| R5 (controller endpoints + admin pin) | SS-02 |
| R6 (transactional scan + idempotency) | SS-02 |
| R7 (WalkUpRegisterPage + draft persistence) | SS-03 |
| R8 (legacy coexistence) | SS-04 |
| R9 (build/test clean + concurrency tests) | SS-02, SS-03 |

## Execution

Run `/forge-run docs/specs/2026-04-25-walkup-cash-register-rewrite.md` to execute all phase specs.
