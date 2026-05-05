---
date: 2026-05-05
topic: "Mobile pickup order lookup and scan workflow"
author: Caleb Bennett
status: draft
tags:
  - design
  - mobile-pickup
  - pickup-scan
  - joy-pass
---

# Mobile Pickup Scan Workflow -- Design

## Summary
Add phone-first pickup routes that let authenticated, role-authorized users look up an order and scan items into that order from a phone camera or manual entry. This is an additive workflow under `/mobile/*`; existing desktop pickup and kiosk routes keep working as they do today after the new shared authentication boundary.

## Approach Selected
**Additive Mobile Pickup Flow.** Build new mobile pages that reuse backend fulfillment rules and shared scanner components instead of rewriting the desktop pickup pages.

## Architecture
```text
/mobile/pickup
        |
        +--> search or scan order barcode
        |
        v
/mobile/pickup/:orderId
        |
        +--> scan item/order-line barcode by camera or manual entry
        |
        v
existing fulfillment API/service behavior
        |
        v
mobile Joy feedback and next scan
```

The mobile workflow changes input and layout, not fulfillment semantics. Existing concurrency-safe server behavior remains authoritative.

## Components
**Mobile pickup lookup page** lets the user find an order by typing/manual entry or by scanning an order barcode/QR code. Exact matches can open directly; ambiguous matches show a safe mobile result list.

**Mobile pickup scan page** shows order identity, customer summary, fulfillment progress, scanner/manual entry, last scanned value, item result feedback, and order completion status.

**Role guard** requires a user role that can perform pickup work, such as `Pickup` or `Admin`.

**Scanner integration** consumes the shared scanner payload and decides whether the value should be submitted as a pickup item scan, rejected as the wrong code type, or surfaced for manual recovery.

**Joy feedback layer** adapts existing scan success/error patterns for phones: large accepted/not found/wrong order states, short vibration/audio when supported, and one-hand-friendly controls.

## Data Flow
The user opens `/mobile/pickup`, searches or scans an order code, and navigates to `/mobile/pickup/:orderId` when one order is safely selected.

On the order scan page, camera or manual entry emits a normalized scan payload. The page pauses scanning, submits the decoded code to the fulfillment API for the selected order, renders the backend result, then resumes scanning when safe.

The server remains the source of truth for wrong order, already fulfilled, out-of-stock, sale-closed, and concurrency cases.

## Error Handling
- No order match keeps the user on mobile pickup lookup with retry/manual entry available.
- Multiple order matches require explicit selection.
- Wrong item/order shows a clear mobile error and stays on the current order.
- Already fulfilled shows a specific already-picked state.
- Backend/network failure does not mark anything fulfilled locally and offers retry.
- Duplicate rapid-fire scans are ignored by the scanner foundation and by pending-state pause.
- Offline state blocks scan submission with connection-required messaging.

## Open Questions
- Decide whether mobile pickup can complete/force-complete orders or only scan items. Recommendation: allow normal completion for `Pickup`, reserve force-complete for `Admin`.
- Decide whether sale-closed behavior mirrors desktop exactly. Recommendation: yes.
- Decide whether order lookup scans should support QR codes encoding order numbers in addition to current printed barcodes. Recommendation: scanner supports QR; backend/lookup accepts decoded order numbers.

## Approaches Considered
**Make Existing Pickup Pages Responsive** was rejected because the desktop pickup site works well and should not be disturbed.

**Mobile Pickup Wrapper Around Desktop Components** was rejected because desktop components would accumulate mobile-only branching.

**Additive Mobile Pickup Flow** was selected because it keeps the working desktop route stable while delivering a true phone workflow.

## Next Steps
- [ ] Turn this design into a Forge spec after auth, mobile shell, and scanner foundation.
- [ ] Define exact API calls reused from desktop pickup.
- [ ] Add test cases for scan success, wrong order/item, already fulfilled, duplicate scan prevention, and backend failure.
- [ ] Verify on Android Chrome, iPhone Safari, and installed PWA mode.
