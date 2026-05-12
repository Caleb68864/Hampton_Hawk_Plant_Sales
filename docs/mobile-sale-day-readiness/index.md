# Mobile Sale Day Readiness

This bundle covers everything volunteers and supervisors need to set up and operate the Hampton Hawks Plant Sales mobile experience on sale day.

## Documents

1. [HTTPS & LAN Deployment](./01-https-lan-deployment.md) — Deploy the app on the local network with a secure context for camera access.
2. [PWA Install Guide](./02-pwa-install-guide.md) — How to install the web app to the home screen on iPhone and Android.
3. [Device Readiness Checklist](./03-device-readiness-checklist.md) — Pre-sale device verification checklist for every volunteer.
4. [Account & Role Setup](./04-account-role-setup.md) — User accounts, assigned roles, and permission boundaries.
5. [Test Fixtures](./05-test-fixtures.md) — Synthetic barcodes and order values for pre-sale smoke testing (dev/disposable only).
   - [Printable Fixture Cards](./05-test-fixtures-printable.html) — Print-ready HTML with per-fixture cards and symbolic barcodes.
6. [Fallback Playbook](./06-fallback-playbook.md) — Volunteer and supervisor actions for every sale-day failure mode.
7. [Audit & Troubleshooting Guide](./07-audit-troubleshooting.md) — How supervisors query the scan audit log, identify event actors and outcomes, and investigate anomalies.
8. [Hardening Verification Log](./08-hardening-verification.md) — Results of the pre-sale hardening pass: print-import check, service-worker cache audit, and behavioral test status.

9. [Joy Visual Audit](./09-joy-visual-audit.md) — Parity matrix verifying the mobile shell matches the Joy design language across all target viewports.
10. [Morning-Of Sale Checklist](./10-morning-of-sale-checklist.md) — ≤ 15-minute checkbox checklist for sale-day morning setup.

### Smoke Test Plan

The end-to-end sale-day smoke test is documented as individual runnable scenarios:

- [Smoke Test Plan](../tests/2026-05-07-mobile-sale-day-readiness/test-plan.md) — Overview and index of all 10 SD-NN scenarios.

## Before Sale Day

Work through each document in order. Complete the [Device Readiness Checklist](./03-device-readiness-checklist.md) on every device that will be used on sale day. Run the [Test Fixtures](./05-test-fixtures.md) smoke tests to verify each scan path before volunteers arrive. Keep the [Fallback Playbook](./06-fallback-playbook.md) accessible at the supervisor station during the sale.

On the morning of the sale, execute the [Morning-Of Sale Checklist](./10-morning-of-sale-checklist.md) before volunteers arrive.
