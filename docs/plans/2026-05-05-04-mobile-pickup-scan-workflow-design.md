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

## Contract With Prior Plans
This plan depends on:

- user authentication and roles
- mobile Joy shell and online-only PWA behavior
- reusable camera scanner foundation
- mobile sale-day readiness and hardening for final rollout validation

The mobile pickup pages should use the same auth session and role checks as desktop. The page may hide controls based on role, but backend fulfillment endpoints remain the real authorization boundary.

The scanner foundation provides only decoded values. Mobile pickup owns:

- deciding whether the scan is an order code or item code
- normalizing item barcode values
- submitting item scans to fulfillment APIs
- rendering fulfillment result feedback
- resuming or stopping scanner after each result

This plan must produce enough runtime signal for `2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md` to verify who scanned what and from where. Each scan request or fulfillment event should include or derive:

- authenticated user id / username
- role-relevant station account name
- source (`mobile-camera` or `manual-entry`)
- scanned timestamp
- order id/order number context
- result category, such as accepted, already fulfilled, wrong order, not found, blocked, or backend error

## Role And Permission Rules
- `Pickup` and `Admin` can open `/mobile/pickup` and `/mobile/pickup/:orderId`.
- `Pickup` can scan items into an order and perform normal complete-order behavior if desktop pickup allows equivalent completion.
- `Admin` can access admin-only recovery actions if the mobile workflow exposes them.
- Force-complete, reset, override, or sale-closed bypass actions should remain `Admin` only.
- `LookupPrint` alone should not scan items into orders unless that account also has `Pickup`.
- All scan/fulfillment API calls must be protected server-side by `Pickup` or `Admin`.

## Data Flow
The user opens `/mobile/pickup`, searches or scans an order code, and navigates to `/mobile/pickup/:orderId` when one order is safely selected.

On the order scan page, camera or manual entry emits a normalized scan payload. The page pauses scanning, submits the decoded code to the fulfillment API for the selected order, renders the backend result, then resumes scanning when safe.

The server remains the source of truth for wrong order, already fulfilled, out-of-stock, sale-closed, and concurrency cases.

The scan page should model the workflow as explicit UI states:

- loading order
- ready to scan
- scanner active
- submitting scan
- accepted
- warning/recoverable result
- blocked/error result
- order complete
- connection required

The page should not optimistically mark items fulfilled before the backend response returns.

## Backend/API Expectations
Prefer reusing existing desktop fulfillment endpoints and DTOs. Add mobile-specific endpoints only if the current API cannot support a clean phone workflow without over-fetching or unsafe client-side assumptions.

If a new mobile-specific response shape is needed, it should include enough data to render the next scan state without a second request:

- order id and order number
- customer display name
- order status
- item/line scan result
- fulfilled count and remaining count
- display message
- whether the order is now complete
- whether scanning may resume

The backend should remain idempotent/concurrency-safe for duplicate or near-simultaneous scans. Mobile debounce is helpful UX, not the integrity boundary.

Mobile fulfillment should preserve or extend auditability. If existing fulfillment events do not capture user/source information, this plan should add the minimum fields needed for sale-day troubleshooting without turning this into a full analytics system.

The implementation should expose enough detail for a supervisor/admin to answer: which account scanned this item, when, by camera or manual entry, and what result did the backend return?

## Error Handling
- No order match keeps the user on mobile pickup lookup with retry/manual entry available.
- Multiple order matches require explicit selection.
- Wrong item/order shows a clear mobile error and stays on the current order.
- Already fulfilled shows a specific already-picked state.
- Backend/network failure does not mark anything fulfilled locally and offers retry.
- Duplicate rapid-fire scans are ignored by the scanner foundation and by pending-state pause.
- Offline state blocks scan submission with connection-required messaging.
- Expired auth during scan redirects to login and does not locally record success.
- Sale closed behavior should match desktop: normal scan operations block unless an admin-only path explicitly permits recovery.
- If the user scans an order barcode on the item scan page, show a wrong-code-type message and keep the current order loaded.
- If the user scans an item barcode on the order lookup step, either ignore it with a clear message or route it through lookup only if a safe order association exists; do not guess.
- If order data changes while the mobile page is open, the backend response wins and the page should refresh order progress after meaningful mutations.

## Open Questions
- Decide whether mobile pickup can complete/force-complete orders or only scan items. Recommendation: allow normal completion for `Pickup`, reserve force-complete for `Admin`.
- Decide whether sale-closed behavior mirrors desktop exactly. Recommendation: yes.
- Decide whether order lookup scans should support QR codes encoding order numbers in addition to current printed barcodes. Recommendation: scanner supports QR; backend/lookup accepts decoded order numbers.

## Verification Notes
Add focused test coverage for:

- role gating for pickup users vs lookup-only users
- exact order scan opens one order
- ambiguous order lookup does not auto-open
- item scan success
- duplicate item scan cooldown
- already fulfilled item result
- wrong order/wrong item result
- sale-closed blocked result
- backend failure retry
- manual entry path
- no local success on auth expiration
- scan event/user/source audit metadata
- duplicate scan protection at both UI pause/debounce and backend integrity layers

Manual mobile verification should include Android Chrome, iPhone Safari, and installed PWA mode with a real or test barcode set.

The readiness plan will rely on this workflow having a repeatable smoke path:

1. log in as a pickup-capable user
2. open `/mobile/pickup`
3. find a known test order
4. scan a known test item
5. verify result feedback
6. verify backend/order state changed only after server success
7. verify audit/source metadata is visible in logs, admin history, or test output

## Approaches Considered
**Make Existing Pickup Pages Responsive** was rejected because the desktop pickup site works well and should not be disturbed.

**Mobile Pickup Wrapper Around Desktop Components** was rejected because desktop components would accumulate mobile-only branching.

**Additive Mobile Pickup Flow** was selected because it keeps the working desktop route stable while delivering a true phone workflow.

## Next Steps
- [ ] Turn this design into a Forge spec after auth, mobile shell, and scanner foundation.
- [ ] Define exact API calls reused from desktop pickup.
- [ ] Add test cases for scan success, wrong order/item, already fulfilled, duplicate scan prevention, and backend failure.
- [ ] Verify on Android Chrome, iPhone Safari, and installed PWA mode.
