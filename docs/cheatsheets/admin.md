# Admin Cheat Sheet

## Logging In

The app requires an authenticated account. Navigate to `http://localhost:3000` (or your deployment URL) and you will be redirected to the login page.

Enter your username and password. Passwords are managed by the admin through the user management interface.

---

## User Roles

| Role | Can Access |
|---|---|
| `Admin` | Everything, including user management and settings |
| `Pickup` | Pickup lookup and scan station |
| `LookupPrint` | Lookup and print station |
| `POS` | Walk-up order creation |
| `Reports` | Dashboard and reporting views |

Assign station accounts the minimum role needed for their job. A user can hold multiple roles.

**Recommended station account naming:** `Pickup1`, `Pickup2`, `POS2`, `POS3`, `LookupPrint1`  
These names map to physical sale-day devices so you can trace activity in logs.

---

## First-Time Setup (Admin Bootstrap)

On first deployment the app reads `Bootstrap__AdminUsername` and `Bootstrap__AdminPassword` from the environment and creates an admin account if none exists. Repeated restarts with the same values will not create duplicates.

Set these in your `.env` file or compose overrides:

```
Bootstrap__AdminUsername=admin
Bootstrap__AdminPassword=changeme
```

Change the password after the first login by having another admin reset it, or configure a strong initial password before deployment.

---

## Creating Station Accounts

1. Log in as **Admin**.
2. Go to **Settings → User Management**.
3. Click **Create User**.
4. Enter a username (e.g., `Pickup1`), a temporary password, and select the appropriate role(s).
5. Share the credentials with the volunteer or tape them to the device.

Volunteers log in on their browser and the device stays logged in for the duration of the sale. Disable the account when the event ends.

---

## Resetting a Password

1. Log in as **Admin**.
2. Go to **Settings → User Management**.
3. Find the account and click **Reset Password**.
4. Enter and confirm the new password.
5. The user can log in immediately with the new password.

---

## Disabling a Station Account

1. Log in as **Admin**.
2. Go to **Settings → User Management**.
3. Find the account and click **Disable**.
4. The account is immediately blocked — existing sessions are rejected on the next API call.

Disabled users cannot log in and any in-progress session is invalidated.

> The system prevents disabling the last remaining active Admin account.

---

## Logging Out

Click **Logout** in the top navigation. The session cookie is cleared and the browser redirects to `/login`.

---

## Admin PIN (Legacy Protected Actions)

Some actions still use the separate admin PIN system for additional confirmation:

- Closing or reopening the sale
- Force-completing orders
- Resetting orders back to Open
- Overriding walk-up inventory limits

The admin PIN is set via the `APP_ADMIN_PIN` environment variable (default: `1234`).

When prompted:
1. Enter the admin PIN.
2. Enter a reason for the action (used for audit logs).
3. Confirm.

Use specific reasons for auditability. Examples:
- `Customer accepted substitution approved by lead`
- `Wrong order scanned at station 2`
- `Late pickup window approved`

---

## Settings Page

Navigate to **Settings** (Admin only).

### Closing the Sale

1. Click **Close Sale**.
2. Enter the admin PIN.
3. Provide a reason (e.g., "Fundraiser ended").

This blocks new orders, modifications, pickup scanning, and imports.

### Reopening the Sale

1. Click **Reopen Sale**.
2. Enter the admin PIN.
3. Provide a reason.

---

## Managing Inventory

- Go to **Inventory** to see current stock levels.
- Click a plant row to adjust quantities.
- Use **Adjust** for relative changes (+5, -3).
- Use **Set** for absolute values.

---

## Importing Data

1. Go to **Imports**.
2. Choose the import type: Plants, Inventory, or Orders.
3. Upload a CSV or Excel file.
4. Review the batch results — check for row-level issues.

Imports are blocked when the sale is closed.

---

## Reports / Dashboard

- **Dashboard** shows key metrics: total orders, fulfillment progress, low inventory alerts.
- **Problem Orders** shows orders with issues (stalled, over-fulfilled).
- **Low Inventory** shows plants below the threshold.

---

## Walk-Up Orders

- Go to **Walk-Up → New Order** for day-of customers.
- The system calculates available inventory (on-hand minus pre-order commitments).
- If a walk-up exceeds available stock, an admin override is required (enter admin PIN when prompted).

---

## Force Complete / Reset

- On the pickup scan page, use **Force Complete** if items are unavailable.
- Use **Reset** to clear all fulfillment and start over.
- Both require the admin PIN and a reason.

---

## Kiosk Mode

Kiosk mode locks a browser to a specific station view. It is browser-local (per device).

Configure from **Settings → This Device**.

Available kiosk profiles:
- `Pickup` — locks to the pickup lookup and scan workflow
- `LookupPrint` — locks to the lookup and print workflow

**Admin Unlock** in the kiosk header temporarily exits kiosk mode (requires admin PIN).
