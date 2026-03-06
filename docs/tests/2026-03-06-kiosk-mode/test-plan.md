# Kiosk Mode Manual Verification Plan

## Setup
1. Start the project and open the web app.
2. Use one normal browser profile and, if possible, a second browser profile for the device-local check.
3. Make sure you know the current admin PIN.

## Scenarios
- [UI-01-pickup-kiosk-lockdown.md](./UI-01-pickup-kiosk-lockdown.md)
- [UI-02-lookup-print-kiosk.md](./UI-02-lookup-print-kiosk.md)
- [UI-03-kiosk-print-return.md](./UI-03-kiosk-print-return.md)

## Coverage Map
- Device-local kiosk enable and disable: UI-01
- Route lockdown and shell swap: UI-01 and UI-02
- Pickup back-to-lookup recovery: UI-01
- Dedicated lookup/print station workflow: UI-02
- Print return-to-station behavior: UI-03
- Device-local isolation across browsers: UI-01

## Notes
- Do not use the current `/walkup/new` flow as part of kiosk testing.
- If print previews are blocked, allow pop-ups and repeat the step before filing a bug.
