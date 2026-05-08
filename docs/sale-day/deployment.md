---
title: Sale-Day Deployment Guide
audience: ops / sale-day supervisor
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Sale-Day Deployment

This document describes how the Hampton Hawks Plant Sales app is reachable on
sale day -- where the API runs, how the volunteer's phone reaches it, what
environment variables matter, and what URL belongs on the home screen.

## Audience

The sale-day supervisor (the person who configured the Wi-Fi router, brought
the laptop running the API, and is staffing the printer table) and the
deploying ops engineer.

## Architecture (sale-day shape)

```
+-----------+       Wi-Fi (LAN, HTTPS)        +-----------------+
|  Phone /  |  <----------------------------> |   Laptop / NUC  |
|  Tablet   |                                 |   running API   |
|  PWA      |                                 |   + web (vite   |
|           |                                 |    build, served|
|           |                                 |    by API or    |
|           |                                 |    nginx)       |
+-----------+                                 +-----------------+
                                                       |
                                                       v
                                              +-----------------+
                                              |  Postgres 16    |
                                              |  (same host)    |
                                              +-----------------+
```

Everything is on a single LAN. There is no public internet dependency on sale
day. The API, the web bundle, and Postgres run on a single laptop (or NUC) at
the registration table.

## Endpoint URL

The volunteer-facing URL is:

```
<sale-day-endpoint TBD>
```

`<TBD>` -- needs ops decision: is the laptop reachable as `https://hawks.local`
via mDNS, as a static-IP `https://192.168.x.y`, or as a tunnel (Cloudflare /
Tailscale)? Once decided, replace this placeholder everywhere it appears in
this folder.

## HTTPS is required

Camera scanning **will not work** without a secure context. Mobile browsers
refuse `getUserMedia` over plain HTTP except on `localhost`.

| Context | Camera works? | Notes |
|---------|---------------|-------|
| `https://...` | Yes | Required for sale day |
| `http://localhost:3000` | Yes | Dev only, on the host machine |
| `http://192.168.x.y` | **No** | Browsers block camera on plain HTTP LAN |
| Self-signed HTTPS | Yes (after trust prompt) | Acceptable for sale day if the volunteer accepts the prompt once |

If the laptop serves over plain HTTP, scanning silently degrades to manual
entry. That is documented in `fallback-playbook.md`, but it should not be the
plan.

## Environment variables (API)

| Var | Purpose | Sale-day value |
|-----|---------|----------------|
| `ConnectionStrings__Default` | Postgres DSN | Local socket / `127.0.0.1` |
| `ASPNETCORE_URLS` | Kestrel binding | `https://0.0.0.0:5001` (or behind nginx) |
| `Auth__Jwt__Issuer` | JWT issuer | <TBD ops> |
| `Auth__Jwt__Audience` | JWT audience | <TBD ops> |
| `Auth__Jwt__SigningKey` | JWT signing key | <TBD ops -- NEVER commit> |
| `AdminPin` | Admin override PIN | <TBD ops> |

`<TBD ops>` -- the auth plan owns the canonical JWT config; ops must decide
whether the sale-day deployment uses a fresh signing key or the staging key.

## Web bundle

The web bundle is built once before sale day:

```bash
cd web
npm install
npm run build
```

The `dist/` output is then served either:

- by the API as static files, or
- by an nginx sidecar on the same host.

Either is fine. The PWA `manifest.webmanifest` (in `web/public/`) is included
in the build and instructs the browser to launch at `/mobile`.

## What URL goes on the volunteer's home screen?

The full HTTPS URL of the deployment plus `/mobile`:

```
<sale-day-endpoint TBD>/mobile
```

The PWA manifest's `start_url` is `/mobile`, so once the user adds the app to
the home screen, tapping the icon opens directly into the mobile shell.

See `install-pwa.md` for the step-by-step.

## Service worker

`web/public/service-worker.js` caches **only the shell** (HTML, manifest, PWA
icons). Every request matching `/api/*`, `/auth/*`, `/login`, `/logout`,
`/scan`, `/order`, `/fulfillment`, `/report`, `/users`, `/health`, or any
other operational path is bypassed and goes straight to the network. There is
no offline queueing, no API caching, no background sync. Sale-day operation
is online-only by design.

## Pre-deploy checklist (T-1 day)

- [ ] Postgres is running and migrated to head.
- [ ] API health endpoint returns 200 from the laptop itself.
- [ ] API health endpoint returns 200 from a phone on the same Wi-Fi.
- [ ] HTTPS is enabled (or self-signed cert is trusted on at least one phone).
- [ ] `npm run build` artifact is deployed.
- [ ] Manifest URL `/manifest.webmanifest` returns 200.
- [ ] At least one volunteer account exists for each role used on sale day.
- [ ] `<sale-day-endpoint TBD>` placeholder above is replaced with the real URL.

## Related

- `install-pwa.md` -- volunteer-facing add-to-home-screen instructions.
- `device-checklist.md` -- per-phone sale-day readiness.
- `fallback-playbook.md` -- what to do when this deployment misbehaves.
