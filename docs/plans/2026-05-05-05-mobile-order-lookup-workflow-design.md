---
date: 2026-05-05
topic: "Mobile order lookup workflow without mobile printing"
author: Caleb Bennett
status: draft
tags:
  - design
  - mobile-lookup
  - order-lookup
  - joy-pass
---

# Mobile Order Lookup Workflow -- Design

## Summary
Add a phone-first order lookup workflow for authenticated users who need to find orders on mobile and then scan into the correct order. This is not a mobile print workflow. It exists to help staff find the right order and continue into mobile pickup scanning.

## Approach Selected
**Lookup-To-Scan Mobile Flow.** Mobile order lookup should be a focused path from order/customer search or scanned order code to the appropriate mobile pickup scan page. Existing `/lookup-print` remains the desktop/kiosk print station.

## Architecture
```text
/mobile/lookup
        |
        +--> type search
        +--> manual entry
        +--> camera scan order barcode/QR
        |
        v
mobile order results or exact match
        |
        v
/mobile/pickup/:orderId
```

Mobile lookup should not add print controls. Phone users look up the order and then scan into it.

## Components
**Mobile lookup page** owns search input, scan/manual entry controls, recent or filtered results if useful, customer/order summary cards, and exact-match navigation.

**Order result card** shows enough detail to choose safely on a phone: order number, customer name, status, item count/progress, and a primary action to open mobile pickup scanning.

**Role guard** allows users with lookup/pickup responsibilities, such as `LookupPrint`, `Pickup`, or `Admin`, depending on final policy. If `LookupPrint` users should not scan items, they can look up orders but not open scan actions unless also granted `Pickup`.

**Scanner integration** uses the reusable scanner foundation to accept camera or manual decoded order values. Manual entry remains available at all times.

## Contract With Prior Plans
This plan depends on:

- user authentication and roles
- mobile Joy shell and online-only PWA behavior
- reusable camera scanner foundation
- mobile pickup scan workflow
- mobile sale-day readiness and hardening for final rollout validation

Mobile lookup is not the scanner foundation and not a print station. It consumes scanner results only for order/customer lookup and routes to mobile pickup when the user is allowed to scan into orders.

The page should reuse existing order lookup normalization helpers where practical so desktop scanner/order-number behavior and mobile scanner/order-number behavior do not drift.

The lookup workflow must be explicit about what can be searched on a phone. Recommended first-pass search inputs:

- exact order number / printed order barcode value
- customer first/last name
- pickup code if one exists in current order data
- seller name only if existing APIs already support it cleanly

Do not silently add broad admin-style order search if it makes phone results noisy or slow. Sale-day readiness depends on lookup behavior being predictable enough to teach quickly.

## Role And Permission Rules
- `Admin` can look up orders and open mobile pickup scanning.
- `Pickup` can look up orders and open mobile pickup scanning.
- `LookupPrint` can look up orders if that role is intended for lookup work, but should not open mobile pickup scanning unless it also has `Pickup`.
- `POS` should not automatically get order pickup access unless the auth spec explicitly grants it.
- The UI may hide scan-into-order actions, but backend route/API authorization must enforce the same boundary.
- Mobile lookup has no print controls for any role.

## Data Flow
The page accepts typed text, manual entry, or camera-decoded values. It queries existing order/customer APIs where possible, normalizes order barcode values, and either opens a single exact order match or presents a short mobile-friendly result list.

When the user selects an order, the app navigates to `/mobile/pickup/:orderId` if the user's role allows scanning into orders. If not, the user can view the lookup result but cannot perform scan actions.

The lookup page should distinguish three input intentions:

- exact order code or barcode
- customer/name/order search text
- unsupported item barcode

Exact order-code matches may auto-open only when there is exactly one safe match and the user's role permits the next action. Search text should show results instead of surprising the user with navigation. Unsupported item barcodes should show a clear wrong-code-type message.

Result cards should include enough information for safe mobile selection:

- order number
- customer name
- status
- pickup/fulfillment progress if available
- item count if available
- a clear primary action based on role, such as `Open Scan` or `View Order`

For readiness testing, the lookup workflow should support a known test order path. That can be documented test data, a seeded fixture in local/dev, or instructions for selecting a real non-production order. The plan should avoid making readiness depend on a fragile customer name or whatever order happened to be imported last.

## Error Handling
- No match shows a clear not-found state and keeps input ready.
- Multiple matches are shown as selectable cards; no ambiguous auto-open.
- Scanned item barcode on lookup should show “This looks like an item barcode. Scan an order code or search by customer/order.”
- User without pickup permission should not see scan-into-order actions.
- Network/backend failure shows retry messaging.
- Offline state blocks lookup with connection-required messaging.
- Expired auth redirects to login and returns to `/mobile/lookup` when safe.
- Backend search errors should not clear the user's typed query.
- Very broad search results should be capped or paginated for phone usability.
- Result cards should avoid exposing admin-only actions or print links.
- If the selected order becomes unavailable or deleted before opening scan, show a recoverable error and return to lookup.

## Open Questions
- Decide whether `LookupPrint` role can open mobile pickup scan pages or only lookup. Recommendation: keep lookup and pickup permissions separate.
- Decide whether mobile lookup should show recent active orders before searching. Recommendation: yes if it helps sale-day flow, but keep the first pass simple.
- Decide final copy for wrong-code-type scan feedback.

## Verification Notes
Add focused test coverage for:

- exact order-code match
- broad text search results
- no match
- multiple matches
- unsupported item barcode feedback
- lookup-only role cannot open scan
- pickup/admin role can open scan
- no print controls render
- offline state blocks lookup
- backend error preserves query
- exact order-number scan routes to the same order desktop lookup would find
- lookup-only role can find but cannot scan into an order
- readiness smoke test can find a known test order predictably

Manual verification should include one-handed use at 375px and 430px widths, with enough order/customer text to prove cards wrap cleanly without overlap.

The readiness plan will rely on this workflow having a repeatable smoke path:

1. log in as a lookup-capable user
2. open `/mobile/lookup`
3. search or scan a known test order code
4. verify exact match behavior
5. verify no print controls exist
6. verify pickup-capable users can continue to `/mobile/pickup/:orderId`
7. verify lookup-only users cannot scan into the order

## Approaches Considered
**Mobile Print Station** was rejected by product decision: mobile has no print ability.

**Reuse Desktop LookupPrintStationPage** was rejected because desktop lookup/print has print concerns and table-like layout not needed on mobile.

**Lookup-To-Scan Mobile Flow** was selected because it keeps the phone task narrow: find the order, then scan into it.

## Next Steps
- [ ] Turn this design into a Forge spec after auth, mobile shell, scanner foundation, and mobile pickup.
- [ ] Decide final role boundaries between lookup-only and pickup-scanning users.
- [ ] Add tests for exact match, no match, multiple match, wrong-code-type scan, and permission-denied scan action.
