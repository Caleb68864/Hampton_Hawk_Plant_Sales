# Account & Role Setup

This document lists the sale day user accounts, their assigned roles, the minimum permissions each role requires, and operations that must NOT be available to that role.

---

## Sale Day Accounts

| Account | Role | Minimum Roles / Permissions | Must NOT Allow |
|---------|------|-----------------------------|----------------|
| `Pickup1` | Order Pickup Volunteer | View orders, mark orders as fulfilled, scan barcodes | Create/edit/delete orders, access admin panel, view financial data, process payments |
| `Pickup2` | Order Pickup Volunteer | View orders, mark orders as fulfilled, scan barcodes | Create/edit/delete orders, access admin panel, view financial data, process payments |
| `POS2` | Point-of-Sale Volunteer | Process walk-up sales, scan barcodes, view inventory availability | Delete orders, access admin panel, modify pre-orders, change product/pricing data |
| `POS3` | Point-of-Sale Volunteer | Process walk-up sales, scan barcodes, view inventory availability | Delete orders, access admin panel, modify pre-orders, change product/pricing data |
| Temporary mobile user | Short-term volunteer | Scan barcodes, view assigned queue (pickup or POS depending on assignment) | Financial reports, admin actions, order deletion, role/user management |

---

## Role Descriptions

### Pickup Role (Pickup1, Pickup2)

Pickup volunteers work the order fulfillment area. They scan the QR code on a customer's order confirmation, locate the plants, and mark the order as picked up.

- Can view: order details, customer name, ordered items, fulfillment status.
- Can do: mark an order line or full order as fulfilled.
- Cannot do: change prices, add/remove items, issue refunds, access the admin dashboard.

### POS Role (POS2, POS3)

POS volunteers work the walk-up sales station. They process customers who arrive without a pre-order.

- Can view: walk-up inventory availability, product list with prices.
- Can do: create a new walk-up sale, scan items, record payment (cash/card confirmed externally).
- Cannot do: modify pre-orders, delete completed transactions, view financial summary reports, access admin settings.

### Temporary Mobile User

Used for last-minute volunteer additions. The account is assigned a specific task (Pickup or POS) on the morning of the sale.

- Permissions are scoped to the assigned task only — do not grant broad access.
- Deactivate this account at end of sale day.
- Do not share this account across multiple people simultaneously.

---

## Admin PIN

The supervisor uses the Admin PIN (configured via environment variable `ADMIN_PIN`) for protected actions such as overriding inventory counts, voiding transactions, and accessing admin reports. The PIN is entered in the `X-Admin-Pin` header and must not be shared with pickup or POS volunteers.

---

## Before Sale Day

1. Verify each account exists in the system and can log in successfully.
2. Confirm the correct role screen appears after login for each account.
3. Test that a Pickup account cannot access the admin dashboard.
4. Test that a POS account cannot modify a pre-order.
5. Assign and brief any temporary mobile user on their specific task.

See [Device Readiness Checklist](./03-device-readiness-checklist.md) for the full device and login verification steps.
