# UI-03 Pickup Order Barcode Recovery

## Goal
Verify safe recovery behavior when a scanned order number has no exact match or multiple exact matches.

## Steps
1. Open `/pickup`.
2. Scan or type an order number that does not exist.
3. Confirm the page stays on `/pickup`.
4. Confirm the screen shows **No order found for scanned barcode/order number.**
5. Click **Clear for Next Order**.
6. Confirm the field clears and focus returns to the pickup search box.
7. If duplicate order numbers can be staged, scan a duplicated order number.
8. Confirm the page shows a duplicate-results list instead of auto-opening one order.
9. Choose one of the duplicate results and confirm it opens the selected order.

## Expected Results
- No-match scans show a clear error and keep the volunteer in the pickup workflow.
- Clearing the lookup makes the station ready to rescan immediately.
- Duplicate exact matches require an explicit operator choice.
