# Test Fixtures for Sale Day Barcode & Order Scanning

> **DISPOSABLE / DEV ONLY** — All values in this document are synthetic test data. None of these barcodes, order IDs, or SKUs represent real customer orders or live inventory. Do not use these values in production databases.

Use these fixtures during pre-sale device testing (see [03-device-readiness-checklist.md](./03-device-readiness-checklist.md)) and developer/QA smoke testing to verify each supported scan path works correctly before volunteers arrive.

---

## Fixture Table

| # | Fixture Name | Barcode Type | Test Value | Expected Behavior | Disposable / Dev Only |
|---|---|---|---|---|---|
| 1 | QR Code — walk-up item | QR Code | `TEST-WU-QR-00001` | Scanner decodes; item lookup returns test plant record | ✅ Yes |
| 2 | Code 128 — preorder label | Code 128 | `TEST-PO-C128-00002` | Scanner decodes; order lookup returns test preorder record | ✅ Yes |
| 3 | UPC-A — retail plant tag | UPC-A (12-digit) | `012345678905` | Scanner decodes; item lookup returns test UPC plant entry | ✅ Yes |
| 4 | EAN-13 — imported plant tag | EAN-13 (13-digit) | `0123456789012` | Scanner decodes; item lookup returns test EAN plant entry | ✅ Yes |
| 5 | Unknown / unsupported code | Code 39 (unsupported) | `*TEST-UNKNOWN*` | Scanner surfaces "Unrecognized barcode format" error; no crash | ✅ Yes |
| 6 | Duplicate scan | QR Code | `TEST-WU-QR-DUP-00006` | First scan fulfills; second scan returns "Already fulfilled" warning | ✅ Yes |
| 7 | Manual entry — walk-up | Manual (keyboard) | `TEST-MANUAL-00007` | User types value; same lookup path as scan; item returned | ✅ Yes |
| 8 | Known order lookup | QR Code | `TEST-ORD-LOOKUP-00008` | Order detail screen shown; customer name "Test Customer Eight" | ✅ Yes |
| 9 | Known item fulfillment | Code 128 | `TEST-ITEM-FULFILL-00009` | Item marked fulfilled; inventory decremented by 1 in test DB | ✅ Yes |

---

## Fixture Details

### Fixture 1 — QR Code Walk-Up Item
- **Barcode type:** QR Code
- **Value:** `TEST-WU-QR-00001`
- **Setup:** Seed a walk-up inventory item with SKU `TEST-WU-QR-00001` in the dev/test database.
- **Steps:** Open scanner, point at printed/displayed QR code, verify item card appears.
- **Pass condition:** Item name and price display within 2 seconds.
- **Disposable / dev only:** Yes — remove before production deployment.

### Fixture 2 — Code 128 Preorder Label
- **Barcode type:** Code 128
- **Value:** `TEST-PO-C128-00002`
- **Setup:** Seed a preorder record linked to barcode `TEST-PO-C128-00002`.
- **Steps:** Scan Code 128 label; verify preorder detail screen appears.
- **Pass condition:** Customer name "Test Customer Two" and order items visible.
- **Disposable / dev only:** Yes.

### Fixture 3 — UPC-A Retail Plant Tag
- **Barcode type:** UPC-A (12 digits)
- **Value:** `012345678905`
- **Setup:** Seed a plant item with UPC `012345678905`.
- **Steps:** Scan UPC barcode; verify item lookup succeeds.
- **Pass condition:** Plant name and price displayed; no format error.
- **Disposable / dev only:** Yes.

### Fixture 4 — EAN-13 Imported Plant Tag
- **Barcode type:** EAN-13 (13 digits)
- **Value:** `0123456789012`
- **Setup:** Seed a plant item with EAN-13 `0123456789012`.
- **Steps:** Scan EAN-13 barcode; verify item lookup succeeds.
- **Pass condition:** Plant name displayed; no format error.
- **Disposable / dev only:** Yes.

### Fixture 5 — Unknown / Unsupported Code
- **Barcode type:** Code 39 (not in supported format list)
- **Value:** `*TEST-UNKNOWN*`
- **Setup:** Print or display a Code 39 barcode with this value.
- **Steps:** Attempt to scan; verify graceful error handling.
- **Pass condition:** "Unrecognized barcode format" message shown; app does not crash; scanner remains active.
- **Disposable / dev only:** Yes.

### Fixture 6 — Duplicate Scan
- **Barcode type:** QR Code
- **Value:** `TEST-WU-QR-DUP-00006`
- **Setup:** Seed a walk-up item with this barcode; mark it as already fulfilled in the test DB before the second scan.
- **Steps:** Scan once (should succeed), scan again (should warn).
- **Pass condition:** Second scan shows "Already fulfilled" or "Duplicate scan" warning; no double-decrement of inventory.
- **Disposable / dev only:** Yes.

### Fixture 7 — Manual Entry Walk-Up
- **Barcode type:** Manual keyboard entry (no camera)
- **Value:** `TEST-MANUAL-00007`
- **Setup:** Seed a walk-up item with SKU `TEST-MANUAL-00007`.
- **Steps:** Tap "Enter manually", type value, submit.
- **Pass condition:** Same item card as scan path; item returned successfully.
- **Disposable / dev only:** Yes.

### Fixture 8 — Known Order Lookup
- **Barcode type:** QR Code
- **Value:** `TEST-ORD-LOOKUP-00008`
- **Setup:** Seed a preorder with order reference `TEST-ORD-LOOKUP-00008`; customer name "Test Customer Eight".
- **Steps:** Scan QR; verify order detail screen.
- **Pass condition:** Order detail shows customer "Test Customer Eight" and at least one line item.
- **Disposable / dev only:** Yes.

### Fixture 9 — Known Item Fulfillment
- **Barcode type:** Code 128
- **Value:** `TEST-ITEM-FULFILL-00009`
- **Setup:** Seed a preorder line item with barcode `TEST-ITEM-FULFILL-00009`; on-hand qty ≥ 1.
- **Steps:** Scan; tap "Fulfill"; verify confirmation.
- **Pass condition:** Item status changes to fulfilled; on-hand qty decrements by 1 in test DB; success message shown.
- **Disposable / dev only:** Yes.

---

## Notes

- All test values use the `TEST-` prefix to distinguish them from any real operational barcodes.
- Seed scripts for the test database are located in `api/tests/` (or the test fixtures seeder). Remove or gate behind an environment flag before production deployment.
- Print fixtures on paper or display on a second device for realistic camera-scan testing.
- See [03-device-readiness-checklist.md](./03-device-readiness-checklist.md) for where in the checklist these fixtures are used.
