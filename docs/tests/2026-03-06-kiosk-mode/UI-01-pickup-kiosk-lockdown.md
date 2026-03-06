# UI-01 Pickup Kiosk Lockdown

## Goal
Verify that Pickup kiosk mode locks this browser into the pickup workflow and that recovery controls stay pickup-specific.

## Steps
1. Open **Settings**.
2. In **This Device**, choose **Pickup** and enable kiosk mode with a valid admin PIN.
3. Confirm the browser redirects to `/pickup`.
4. Confirm the normal top navigation and quick find are gone.
5. Manually browse to `/orders`.
6. Confirm the app redirects back to `/pickup`.
7. Open any order from pickup lookup.
8. On the scan page, click **Back to Lookup**.
9. Confirm the app returns to `/pickup`, not `/station`.
10. In a second browser profile, open the app and confirm kiosk mode did not activate there.
11. Use **Admin Unlock** and a valid PIN to leave kiosk mode.
12. Confirm the browser returns to `/settings` and the full navigation is back.

## Expected Results
- Pickup kiosk remains device-local.
- Blocked routes bounce back to `/pickup`.
- Pickup scan recovery returns to `/pickup`.
- Unlocking restores the full app shell.
