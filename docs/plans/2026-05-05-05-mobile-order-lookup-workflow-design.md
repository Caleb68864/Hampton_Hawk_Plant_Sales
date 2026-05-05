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

## Data Flow
The page accepts typed text, manual entry, or camera-decoded values. It queries existing order/customer APIs where possible, normalizes order barcode values, and either opens a single exact order match or presents a short mobile-friendly result list.

When the user selects an order, the app navigates to `/mobile/pickup/:orderId` if the user's role allows scanning into orders. If not, the user can view the lookup result but cannot perform scan actions.

## Error Handling
- No match shows a clear not-found state and keeps input ready.
- Multiple matches are shown as selectable cards; no ambiguous auto-open.
- Scanned item barcode on lookup should show “This looks like an item barcode. Scan an order code or search by customer/order.”
- User without pickup permission should not see scan-into-order actions.
- Network/backend failure shows retry messaging.
- Offline state blocks lookup with connection-required messaging.

## Open Questions
- Decide whether `LookupPrint` role can open mobile pickup scan pages or only lookup. Recommendation: keep lookup and pickup permissions separate.
- Decide whether mobile lookup should show recent active orders before searching. Recommendation: yes if it helps sale-day flow, but keep the first pass simple.
- Decide final copy for wrong-code-type scan feedback.

## Approaches Considered
**Mobile Print Station** was rejected by product decision: mobile has no print ability.

**Reuse Desktop LookupPrintStationPage** was rejected because desktop lookup/print has print concerns and table-like layout not needed on mobile.

**Lookup-To-Scan Mobile Flow** was selected because it keeps the phone task narrow: find the order, then scan into it.

## Next Steps
- [ ] Turn this design into a Forge spec after auth, mobile shell, scanner foundation, and mobile pickup.
- [ ] Decide final role boundaries between lookup-only and pickup-scanning users.
- [ ] Add tests for exact match, no match, multiple match, wrong-code-type scan, and permission-denied scan action.
