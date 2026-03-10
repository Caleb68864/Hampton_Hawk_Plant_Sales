# LAN Access Setup

## Quick Start

Right-click `start.bat` > **Run as administrator**. It handles firewall rules and displays your LAN IP.

Other devices connect at `http://<server-ip>:3000`.

## What start.bat Does (as admin)

- Creates Windows Firewall inbound rules for ports 3000 and 8080 (private/domain networks only)
- Starts Docker Compose
- Displays the server's LAN IP address

## Optional: Friendly Hostname

If you want clients to use a name like `plantsales.io` instead of an IP, add a DNS entry on your **router**:

1. Log into your router admin page
2. Find the DNS / DHCP settings
3. Add a record mapping `plantsales.io` to the server's IP
4. All devices on the network can then use `http://plantsales.io:3000`

This is a one-time router config — no setup needed on client devices.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Can't connect from LAN | Run start.bat as admin |
| Network set to "Public" | Change to "Private" in Windows network settings |
| Docker ports not forwarding | Restart Docker Desktop, verify WSL2 engine is enabled |
| IP address changed | Re-run start.bat to see new IP; set a static IP or DHCP reservation on your router |

## Cleanup

```powershell
netsh advfirewall firewall delete rule name="HamptonHawks-Web"
netsh advfirewall firewall delete rule name="HamptonHawks-API"
```
