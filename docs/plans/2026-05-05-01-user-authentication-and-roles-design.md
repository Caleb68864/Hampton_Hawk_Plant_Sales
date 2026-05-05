---
date: 2026-05-05
topic: "User authentication and roles for desktop and mobile station workflows"
author: Caleb Bennett
status: draft
tags:
  - design
  - user-authentication
  - roles
  - mobile-stations
---

# User Authentication And Roles -- Design

## Summary
Add first-party user accounts to Hampton Hawks Plant Sales so both desktop and mobile users authenticate the same way before accessing sale-day workflows. The account model should support admin-created station identities such as `POS2`, `POS3`, `Pickup1`, and on-the-fly mobile users, preventing random visitors from opening the mobile site and scanning out their own orders.

## Approach Selected
**Station Accounts + Device Sessions.** The app stores real user accounts and roles, but the operating model is station-friendly: admins create accounts for terminals, mobile devices, or volunteers as needed. This gives strong enough access control for sale day without forcing every workflow into personal volunteer account management.

## Architecture
Authentication becomes an app-wide backend capability used by both desktop and mobile routes.

```text
Admin creates user accounts and roles
        |
        v
Backend stores users, password hashes, active/disabled state, roles
        |
        v
Desktop or mobile login creates an authenticated session
        |
        v
Frontend route guards and backend policies enforce access
```

The desktop app keeps its existing pages and workflows after login. The mobile pages use the same auth session, but live under separate `/mobile/*` routes.

## Components
**Backend user model and auth service** owns users, password hashes, account status, roles, login validation, session creation, logout, and current-user lookup. Passwords must be hashed server-side; plaintext passwords must never be stored.

**Role policies** define access to broad station capabilities. Initial roles should be small and practical: `Admin`, `Pickup`, `LookupPrint`, `POS`, and `Reports`. Frontend checks shape navigation, but backend policies are the true enforcement boundary.

**Admin user management UI** lets admins create users, disable users, reset passwords, and assign roles. There should be no public self-signup. Mobile users and station accounts are created deliberately by an admin.

**Frontend auth store and route guards** own login state, session restore, logout, intended-route return after login, and role-aware redirects. The desktop layout and workflow pages should remain recognizable and should not be rewritten as part of auth.

**Bootstrap admin path** creates the first usable admin account safely. Recommendation: seed an initial admin from environment variables or startup configuration so there is no unauthenticated setup page in production.

## Data Flow
Unauthenticated users who open any protected desktop or mobile route are redirected to login. Login submits username and password to the backend, the backend verifies the active user and password hash, and the app receives a session containing user identity and roles.

Authenticated API requests are identified by middleware and checked against controller or endpoint policies. Unauthenticated requests return `401`; authenticated users without the required role return `403`.

Recommendation: use secure HTTP-only cookie sessions if the LAN/deployment setup supports it cleanly. If cookies become awkward because of deployment topology, use short-lived JWT access tokens with a refresh strategy, but do not store long-lived secrets casually in local storage.

## Error Handling
- Invalid login shows a generic username/password error.
- Disabled accounts cannot log in and should show a clear admin-help message.
- Admins cannot disable or remove the last active `Admin`.
- Duplicate usernames are rejected.
- Expired sessions redirect to login and return to the intended route when safe.
- Wrong-role access shows a friendly access-denied screen.
- Role changes should take effect on next session refresh or next login; the chosen behavior must be documented.
- User-management actions should be logged through the existing admin-action pattern where practical.

## Open Questions
- Confirm the final session mechanism: HTTP-only cookies preferred, JWT fallback if needed.
- Decide whether print routes remain publicly accessible or require auth. Mobile has no print workflow, but desktop print links may need practical handling.
- Decide whether `Reports` is a separate role or part of `Admin`.

## Approaches Considered
**Minimal App Accounts** would add custom username/password users and roles with a small custom auth layer. It is simple, but risks recreating more security plumbing than necessary.

**Full ASP.NET Identity** would use ASP.NET Core Identity for users, roles, lockout, and password hashing. It is robust but heavier than the app may need.

**Station Accounts + Device Sessions** was selected because it uses real stored accounts while matching sale-day reality: admins can create `POS2`, `Pickup1`, and mobile user accounts quickly, and those accounts unlock only the workflows they need.

## Next Steps
- [ ] Turn this design into a Forge spec.
- [ ] Decide the cookie vs JWT implementation detail.
- [ ] Define the exact first-admin bootstrap configuration.
- [ ] Decide print-route auth behavior for desktop.
