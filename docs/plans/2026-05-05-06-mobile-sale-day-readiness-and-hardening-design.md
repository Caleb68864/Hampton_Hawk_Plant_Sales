---
date: 2026-05-05
topic: "Mobile sale-day readiness and hardening"
author: Caleb Bennett
status: draft
tags:
  - design
  - mobile
  - sale-day-readiness
  - hardening
  - pwa
---

# Mobile Sale-Day Readiness And Hardening -- Design

## Summary
Add the operational hardening, documentation, and real-device verification needed to trust the mobile auth, PWA, scanner, lookup, and pickup workflows on sale day. This plan does not add a new user-facing workflow; it proves the previous mobile plans can survive real phones, real Wi-Fi, station accounts, camera permissions, and volunteer handoff.

## Approach Selected
**Operational Readiness Layer.** Treat sale-day readiness as its own final plan rather than scattering checklists across feature specs. The earlier plans must produce testable hooks, audit metadata, and repeatable smoke paths; this plan assembles them into a launch checklist and hardening pass.

## Architecture
```text
Auth + roles
    |
Mobile shell + online-only PWA
    |
Scanner foundation
    |
Mobile lookup + mobile pickup
    |
Sale-day readiness:
  device setup + HTTPS/LAN + test fixtures + smoke tests + fallback playbook
```

This plan sits after the feature work and validates the system end to end. It should not rewrite the scanner or mobile workflows unless readiness testing exposes a concrete bug.

## Components
**HTTPS/LAN deployment guide** explains how phones reach the app using a real LAN hostname or HTTPS endpoint, not `localhost`. Camera scanning in production requires a secure context, so the guide must make this explicit.

**PWA install guide** gives short iPhone Safari and Android Chrome instructions for installing the mobile app and opening `/mobile`.

**Device readiness checklist** covers Wi-Fi, camera permission, screen brightness, screen timeout/auto-lock, installed app launch, battery/charging, and whether the user is signed into the correct station/mobile account.

**Account and role setup checklist** covers admin-created users such as `Pickup1`, `Pickup2`, `POS2`, `POS3`, and temporary mobile users. It should list the minimum roles each account needs and what those roles should not allow.

**Test barcode/order fixture pack** provides known-safe values for QR, Code 128, UPC/EAN, unknown code, duplicate scan, manual entry, known order lookup, and known item fulfillment. These fixtures must not accidentally fulfill real customer items during practice unless the test explicitly uses a disposable/dev order.

**Mobile smoke test script** walks through auth -> mobile shell -> lookup -> pickup scan -> audit verification -> logout.

**Fallback playbook** tells volunteers/supervisors what to do when camera permission is denied, phone dies, Wi-Fi drops, login expires, wrong role is assigned, backend is unavailable, or a barcode will not scan.

**Audit and troubleshooting guide** defines how a supervisor verifies which account scanned an item, when it happened, whether it came from camera or manual entry, and what result the backend returned.

## Data Flow
Readiness uses the real production-like flow:

```text
Admin creates station/mobile users
        |
        v
Phone installs/opens PWA over HTTPS/LAN
        |
        v
User logs in
        |
        v
/mobile lookup finds known order
        |
        v
/mobile pickup scans known item
        |
        v
Backend records result + user/source metadata
        |
        v
Supervisor verifies order state and audit trail
```

The readiness checks should run against a safe local/dev dataset first, then a production-like dry run before sale day.

## Dependencies On Prior Plans
This plan depends on all five earlier plans:

- `2026-05-05-01-user-authentication-and-roles-design.md`
- `2026-05-05-02-mobile-joy-shell-and-pwa-design.md`
- `2026-05-05-03-camera-scanner-foundation-design.md`
- `2026-05-05-04-mobile-pickup-scan-workflow-design.md`
- `2026-05-05-05-mobile-order-lookup-workflow-design.md`

The prior plans should provide:

- authenticated station/mobile accounts
- `/mobile` PWA shell
- online-only connection state
- reusable scanner with manual entry
- scanner test/demo route or equivalent safe verification harness
- lookup smoke path for a known test order
- pickup smoke path for a known test item
- scan audit metadata including user/source/result

## Hardening Requirements
- Production/mobile camera use must be over HTTPS or another browser-accepted secure context. Localhost is development only.
- Phones must use a reachable LAN/prod hostname; instructions must not tell phone users to open `localhost`.
- Service worker behavior, if present, must not cache API data or create stale authenticated/order state.
- Scanner and mobile workflows must recover after app switch, phone lock, tab visibility changes, and route changes.
- Manual entry remains the fallback for every scan-dependent workflow.
- Mobile workflows must show clear online/backend unavailable states.
- Mobile lookup and pickup must have no print controls.
- Backend scan/fulfillment integrity remains authoritative over frontend debounce.
- Audit/troubleshooting must identify user/account, source, timestamp, order context, and result category.

## Error Handling And Fallback Playbook
- **Camera denied:** use manual entry; supervisor can help reset browser permission later.
- **No camera / broken camera:** use manual entry or move to another phone.
- **Barcode will not scan:** try manual entry; verify code type; use desktop station if needed.
- **Wrong role:** admin updates user roles or switches to correct account.
- **Login expired:** log in again; do not assume the previous scan succeeded unless backend state confirms it.
- **Wi-Fi drops:** mobile shows connection required; do not queue scans.
- **Backend unavailable:** stop mobile scanning; use desktop/manual operational fallback only if backend is actually available there.
- **Phone dies:** switch to a prepared spare device or desktop station account.
- **Duplicate scan:** UI should suppress rapid duplicates, backend should reject unsafe duplicates, supervisor can verify audit/order state.
- **Sale closed:** mobile behavior mirrors desktop; admin-only recovery remains admin-only.

## Verification Checklist
Mechanical:

- `cd api && dotnet test HamptonHawksPlantSales.sln`
- `cd web && npm run build`
- focused frontend tests for scanner/lookup/pickup route helpers
- focused backend tests for scan audit metadata and role enforcement

Real-device:

- Android Chrome install/open PWA
- iPhone Safari install/open PWA
- camera permission allow/deny
- rear camera selection
- manual entry while camera works
- manual entry when camera is unavailable/denied
- QR test code
- Code 128 test code
- UPC/EAN test code
- duplicate scan test
- app switch/phone lock recovery
- offline mode
- backend unavailable mode

End-to-end smoke:

1. Admin creates or verifies `Pickup1` and a temporary mobile user.
2. Phone opens installed PWA at `/mobile`.
3. User logs in.
4. Mobile shell shows correct account and allowed workflows.
5. User opens `/mobile/lookup`.
6. User finds/scans known test order.
7. User opens `/mobile/pickup/:orderId`.
8. User scans known test item by camera.
9. User repeats with manual entry.
10. User attempts duplicate scan.
11. Supervisor verifies order state and audit/source metadata.
12. User logs out.

## Documentation Deliverables
- `docs/mobile-sale-day-readiness.md` or equivalent readiness guide.
- `docs/tests/2026-05-05-mobile-sale-day-readiness/test-plan.md`.
- Printable or shareable device setup checklist.
- Test barcode/order fixture sheet or instructions.
- Admin account/role setup checklist.
- Fallback playbook.
- Short “morning of sale” smoke test.

## Open Questions
- Where should the production HTTPS/LAN endpoint live for sale day?
- Will there be spare phones/tablets prepared ahead of time?
- Should test barcode fixtures be generated as printable HTML/PDF, or documented as values only?
- Where should scan audit metadata be surfaced for supervisors: admin action log, fulfillment events, a report, or test-only logs?

## Approaches Considered
**Fold readiness into each feature plan** was rejected because operational checks would be scattered and easy to skip.

**Build full offline resilience** was rejected because the app is intentionally online-only and fulfillment requires backend locking.

**Operational readiness layer** was selected because it creates one accountable final pass for real-device, network, role, fallback, and audit validation.

## Next Steps
- [ ] Turn this design into a Forge spec after the scanner, pickup, and lookup specs exist.
- [ ] Decide the HTTPS/LAN sale-day endpoint.
- [ ] Decide where test fixtures and readiness docs should live.
- [ ] Confirm scan audit metadata surface before implementing mobile pickup.
