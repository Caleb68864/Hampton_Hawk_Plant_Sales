# Sale Day Fallback Playbook

This playbook covers the 10 most likely failure modes volunteers and supervisors will encounter during the Hampton Hawks Plant Sale. Each section identifies the problem, the immediate volunteer action, and the escalation path for supervisors.

Cross-references:
- For role and permission issues, see [04-account-role-setup.md](./04-account-role-setup.md).
- For network and server issues, see [01-https-lan-deployment.md](./01-https-lan-deployment.md).

---

## 1. Camera Permission Denied

**Symptom:** Browser shows "Camera blocked" or scanner UI never appears; a lock or camera-slash icon appears in the address bar.

**Volunteer action:**
1. Tap the lock/camera icon in the browser address bar.
2. Set Camera to "Allow" and reload the page.
3. If the option is greyed out, go to device Settings → Apps → Browser → Permissions → Camera → Allow.
4. Return to the scanner page and test with [Fixture 1](./05-test-fixtures.md).

**Supervisor action:**
1. If the volunteer cannot change the permission (managed/kiosk device), switch to manual barcode entry (Fixture 7) until a device with camera access is available.
2. Note the device in the Device Issues log; replace after the rush.

---

## 2. No Camera / Broken Camera

**Symptom:** Device has no rear camera, camera is physically broken, or the camera feed is black/frozen.

**Volunteer action:**
1. Tap "Enter manually" on the scanner screen.
2. Ask the customer to read the order number or item code aloud, or ask to see their confirmation email.
3. Type the code into the manual entry field and submit (see [Fixture 7](./05-test-fixtures.md)).

**Supervisor action:**
1. Mark the device as camera-inoperative in the Device Readiness log.
2. Assign this volunteer to a non-scanning task (cash handling, plant staging) and route scanning orders to a working device.
3. Replace or repair the device before the next sale day.

---

## 3. Barcode Won't Scan

**Symptom:** Camera is active and focused but repeated scan attempts produce no result, or the scanner keeps beeping/flashing without decoding.

**Volunteer action:**
1. Clean the phone camera lens with a soft cloth.
2. Adjust distance (15–25 cm is optimal) and ensure the barcode is fully within the frame.
3. Try under better lighting; shade the barcode from direct glare.
4. If still failing after 3 attempts, tap "Enter manually" and type the code instead.

**Supervisor action:**
1. Inspect the physical barcode for damage, smearing, or printing defects.
2. If the label is damaged, reprint from the admin label-printing screen and re-attach.
3. If multiple barcodes are failing on the same device, suspect a camera focus issue — switch to manual entry for that device and flag it for replacement.

---

## 4. Wrong Role / Insufficient Permissions

**Symptom:** Volunteer sees "Access denied", missing menu items, or cannot complete a transaction that other volunteers can complete.

**Volunteer action:**
1. Do not attempt the action again — repeated unauthorized attempts are logged.
2. Note the exact screen and action that was blocked.
3. Ask a supervisor to complete the action.

**Supervisor action:**
1. Open the admin panel → Users → find the volunteer's account.
2. Verify the assigned role matches what is needed for their station (see [04-account-role-setup.md](./04-account-role-setup.md) for role definitions and permission boundaries).
3. Correct the role assignment, have the volunteer log out and log back in.
4. If the role is correct but access is still denied, check that the volunteer's account is not suspended and that the session token has been refreshed after the role change.

---

## 5. Login Expired / Session Timed Out

**Symptom:** Volunteer is mid-transaction and the app redirects to the login screen, or shows "Session expired / please log in again."

**Volunteer action:**
1. Log in again with the same credentials.
2. Re-navigate to the scanner or order screen and resume.
3. If the last transaction was mid-fulfillment, ask a supervisor to verify whether it completed before retrying.

**Supervisor action:**
1. Check the fulfillment log for the last order the volunteer was processing — confirm whether it recorded as complete or partial.
2. If incomplete, re-open the order and complete it.
3. If login expiry is happening frequently (more than once per volunteer per shift), increase the session timeout in the server config and redeploy (see [01-https-lan-deployment.md](./01-https-lan-deployment.md) for restart procedures).

---

## 6. Wi-Fi Drops / Intermittent Connectivity

**Symptom:** Actions fail silently, spinners never resolve, or the app shows "Network error" or "Unable to reach server."

**Volunteer action:**
1. Check the Wi-Fi indicator in the device status bar — reconnect to the sale-day network if disconnected.
2. Once reconnected, retry the last action.
3. Do not retry the same fulfillment action multiple times before verifying; duplicate fulfillments are hard to reverse. Wait for confirmation before scanning again.

**Supervisor action:**
1. Check the router/access point — see [01-https-lan-deployment.md](./01-https-lan-deployment.md) for the network topology and restart procedure.
2. If the AP is overloaded, ask non-essential devices (personal phones, tablets) to disconnect from the sale network.
3. As a temporary measure, direct volunteers on affected devices to hold transactions and queue orders on paper until connectivity is restored; enter manually in batch when back online.

---

## 7. Backend Unavailable (API / Server Down)

**Symptom:** All devices show errors simultaneously; login fails; no orders can be looked up.

**Volunteer action:**
1. Do not close the app — keep the last successful screen visible for reference.
2. Switch to the paper fallback process: record customer name, item, and quantity on the paper order pad at the supervisor station.
3. Inform customers of the delay; do not turn customers away.

**Supervisor action:**
1. Check the server host machine — see [01-https-lan-deployment.md](./01-https-lan-deployment.md) for the Docker Compose restart procedure (`docker compose restart api`).
2. Check the API health endpoint (`https://<server-ip>/health`) from any browser on the LAN.
3. If the server restarts successfully, have volunteers enter the paper-logged transactions manually before processing new ones.
4. If the server cannot be restarted within 5 minutes, continue on paper and enter data after the sale.

---

## 8. Phone Dies / Battery Dead

**Symptom:** Volunteer's device shuts off mid-transaction.

**Volunteer action:**
1. Note the last order or barcode being processed (ask the customer to confirm).
2. Connect to a charging cable immediately; devices should be kept at ≥ 50% during peak hours.
3. Use a spare device from the device pool at the supervisor station while yours charges.

**Supervisor action:**
1. Verify whether the last transaction on the dead device completed by checking the order log from another device.
2. If incomplete, complete the transaction from a working device.
3. Ensure the charging station at the supervisor table is accessible and cables are working. Enforce the 50%-battery rule from [03-device-readiness-checklist.md](./03-device-readiness-checklist.md).

---

## 9. Duplicate Scan / Accidental Double-Fulfillment

**Symptom:** The app shows "Already fulfilled", "Duplicate scan", or inventory shows an unexpected double-decrement.

**Volunteer action:**
1. Stop scanning and inform the supervisor immediately — do not attempt to "undo" by scanning again.
2. Note the barcode value and approximate time of the duplicate scan.

**Supervisor action:**
1. Open the admin fulfillment log and locate both fulfillment events for the item/order.
2. If the item was physically handed to the customer only once, reverse the duplicate fulfillment using the admin correction screen (requires Admin PIN — see [04-account-role-setup.md](./04-account-role-setup.md)).
3. Re-add the decremented inventory unit via the inventory adjustment screen.
4. Log the incident in the sale day corrections register with the time, barcode, and action taken.

---

## 10. Sale Closed / Outside Sale Hours

**Symptom:** Volunteer attempts to process a walk-up order or fulfillment and receives "Sale is not currently active" or all transaction actions are disabled.

**Volunteer action:**
1. Inform the customer that the sale window has closed.
2. Do not attempt to override the sale-closed state.
3. Direct the customer to the supervisor for any exceptions.

**Supervisor action:**
1. If the sale end time was set incorrectly, log into the admin panel → Sale Settings → extend or reopen the sale window (requires Admin PIN).
2. Only extend the sale window with explicit approval from the event coordinator.
3. If a legitimate late customer needs to be served, process their order manually with supervisor credentials and log the reason for the extension in the sale notes field.

---

## Quick Reference Card

| Failure Mode | Volunteer First Step | Supervisor Escalation |
|---|---|---|
| Camera denied | Re-grant permission in browser/settings | Switch to manual entry |
| No/broken camera | Use manual entry | Reassign volunteer; replace device |
| Barcode won't scan | Clean lens; adjust distance; manual entry | Reprint damaged label |
| Wrong role | Stop; ask supervisor | Fix role in admin panel (see 04) |
| Login expired | Log in again | Check for incomplete transactions |
| Wi-Fi drops | Reconnect; retry once | Restart AP (see 01); paper fallback |
| Backend down | Switch to paper orders | Restart Docker API (see 01) |
| Phone dies | Charge; use spare device | Verify last transaction |
| Duplicate scan | Stop; notify supervisor | Reverse in admin fulfillment log |
| Sale closed | Inform customer | Re-open via admin if authorized |
