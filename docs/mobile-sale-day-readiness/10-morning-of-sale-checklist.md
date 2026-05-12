# Morning-Of Sale Checklist

**Target execution time: ≤ 15 minutes**  
**Execute this checklist on sale day before volunteers arrive.**

---

## Infrastructure (≤ 5 min)

- [ ] Server machine is powered on and connected to the sale-site LAN.
- [ ] Docker services started (`docker compose up -d`); all containers healthy.
- [ ] API responds: `curl -s http://<server-ip>:5000/health` returns `200 OK`.
- [ ] Web app loads in browser at `https://<server-ip>` without TLS error.
- [ ] Confirm HTTPS context is active (padlock or "Secure" in browser address bar).

## Devices (≤ 5 min)

- [ ] Each volunteer phone charged ≥ 80%.
- [ ] Each phone connected to the sale-site Wi-Fi network.
- [ ] Each phone navigated to the app URL and PWA installed to home screen.
- [ ] App opens in standalone mode (no browser address bar) on each device.
- [ ] Camera permission granted on each device (test by opening scan screen).

## Accounts (≤ 2 min)

- [ ] All volunteer accounts created and passwords set (see `04-account-role-setup.md`).
- [ ] Each volunteer can log in successfully on their assigned device.
- [ ] Supervisor account confirmed working.

## Fixture Smoke Test (≤ 2 min)

- [ ] Scan one fixture barcode (from `05-test-fixtures.md`) on one device — success state shown.
- [ ] Verify fulfillment event visible in supervisor audit log.
- [ ] Reset fixture order to unfulfilled state before volunteers begin.

## Final Checks

- [ ] Fallback Playbook (`06-fallback-playbook.md`) open or printed at supervisor station.
- [ ] Supervisor has confirmed their device shows the audit log correctly.
- [ ] All devices set to "Do Not Disturb" or notifications silenced.

---

_Completed by:_ ___________ _Date/Time:_ ___________
