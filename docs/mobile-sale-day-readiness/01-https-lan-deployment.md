# HTTPS & LAN Deployment

## Overview

The mobile scan feature (barcode/QR) requires camera access. Browsers only expose the camera API in a **secure context** (HTTPS or localhost). This document explains how to make the app reachable over the local Wi-Fi network with a valid HTTPS certificate so all devices can use the camera.

---

## Development / Local Testing (localhost only)

> **Dev-only:** `localhost` (and `127.0.0.1`) is treated as a secure context by all modern browsers. This means camera access works when you run `npm run dev` and access the app at `http://localhost:5173` **on the same machine**. This does NOT extend to other devices on the network.

Use localhost during development and unit testing only — it is not suitable for sale day.

---

## LAN Deployment with HTTPS (Sale Day)

For sale day, the API and web app run inside Docker on the sale day laptop, and volunteers access the app from phones/tablets over Wi-Fi.

### Why HTTPS Is Required

- Browsers block camera access on non-secure origins.
- A secure context requires either `localhost` **or** an HTTPS connection with a trusted certificate.
- Accessing `http://192.168.x.x` from a phone is **not** a secure context — camera will be blocked.

### Option A — Self-Signed Certificate + Manual Trust (Recommended for Closed LAN)

1. Generate a self-signed certificate for the LAN IP:
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout lan.key -out lan.crt \
     -subj "/CN=192.168.1.100" \
     -addext "subjectAltName=IP:192.168.1.100"
   ```
   Replace `192.168.1.100` with the actual static IP of the sale day laptop.

2. Mount `lan.key` and `lan.crt` into the Nginx/Caddy reverse proxy container in `docker-compose.yml`.

3. Configure the proxy to terminate HTTPS on port 443 and forward to the web container on port 5173.

4. On each volunteer device, install and trust the `lan.crt` certificate:
   - **iPhone/iPad:** AirDrop the `.crt` file → Settings → Downloaded Profile → Install → Settings → General → About → Certificate Trust Settings → enable full trust.
   - **Android:** Settings → Security → Install from storage → select `lan.crt`.

5. Access the app at `https://192.168.1.100` from each device.

### Option B — mkcert (Developer Tooling)

[mkcert](https://github.com/FiloSottile/mkcert) creates locally-trusted certificates via a local CA. Run:

```bash
mkcert -install
mkcert 192.168.1.100
```

This produces `192.168.1.100.pem` and `192.168.1.100-key.pem`. Install the mkcert root CA on each volunteer device (same steps as Option A step 4 but using the mkcert root CA file).

---

## Verifying Camera Access

After HTTPS is configured and the certificate is trusted on a device:

1. Open the app in Safari (iOS) or Chrome (Android).
2. Navigate to `/mobile`.
3. Tap the scan button — the browser should prompt for camera permission.
4. If the camera dialog never appears, check:
   - The URL bar shows a padlock (HTTPS).
   - The certificate is installed and trusted on the device.
   - Camera permission has not been permanently denied (reset in device Settings).

---

## Firewall Notes

Ensure the sale day laptop's firewall allows inbound TCP on port 443 (or whichever port Docker exposes) from the LAN subnet.

```powershell
# Windows — open port 443 for the sale day session
New-NetFirewallRule -DisplayName "PlantSales HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Remove this rule after the sale if desired.
