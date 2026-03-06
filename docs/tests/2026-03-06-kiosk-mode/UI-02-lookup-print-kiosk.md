# UI-02 Lookup and Print Kiosk

## Goal
Verify that the Lookup & Print kiosk uses the dedicated station page and never exposes the broad Orders workflow.

## Steps
1. Open **Settings**.
2. In **This Device**, choose **Lookup & Print** and enable kiosk mode with a valid admin PIN.
3. Confirm the browser redirects to `/lookup-print`.
4. Confirm the page heading says **Lookup & Print Station**.
5. Search by customer name.
6. Search by order number.
7. Search by pickup code.
8. Confirm each search result only exposes print actions.
9. Manually browse to `/orders`, `/imports`, and `/settings`.
10. Confirm each route redirects back to `/lookup-print`.
11. Search for a value that does not match any order.
12. Confirm the empty state stays on the lookup station and does not suggest walk-up creation.
13. Use **Admin Unlock** and a valid PIN to leave kiosk mode.

## Expected Results
- The kiosk lands on the dedicated `/lookup-print` station page.
- The general Orders page is not reachable while kiosk mode is active.
- Empty and no-match states stay station-safe.
