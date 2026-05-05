# Test Plan: User Authentication and Roles

**Feature:** User Authentication and Roles  
**Date:** 2026-05-05  
**Branch:** `2026/05/05-1453-caleb-feat-user-authentication-and-roles`

## Scope

This plan covers end-to-end verification of the authentication and role system implemented across sub-specs SS-01 through SS-05. It tests the full flow from first-admin bootstrap through station account setup, login/logout, role-based access, and legacy admin PIN compatibility.

Out of scope: mobile shell, PWA install, camera scanning, OAuth/SSO, email reset.

## Environment Setup

1. Start the stack: `docker-compose up --build`
2. Set bootstrap env vars (see Configuration section in README for variable names).
3. Confirm the bootstrap admin is created on first startup.
4. Access the web app at `http://localhost:3000`.

## Test Cases

### AUTH-01 — Bootstrap admin creation on first startup

**Given** `Bootstrap__AdminUsername` and `Bootstrap__AdminPassword` are set and no admin user exists  
**When** the API starts  
**Then** the admin account is created with the `Admin` role and the app is accessible

**Steps:**
1. Set both bootstrap variables (non-empty).
2. Start the stack fresh (`docker-compose up --build`).
3. Check API logs for `Bootstrap admin account '...' created.`
4. Log in with the configured credentials.
5. Confirm login succeeds and the user management page is accessible.

**Pass:** Login succeeds; user management page loads.  
**Fail:** Login fails or 401 is returned.

---

### AUTH-02 — Bootstrap does not duplicate on repeated startups

**Given** the bootstrap admin already exists  
**When** the API restarts with the same credentials configured  
**Then** the existing account is updated (not duplicated)

**Steps:**
1. Restart the stack without resetting the database.
2. Check logs for `Bootstrap admin account '...' updated.`
3. Verify only one admin account with that username exists in user management.

**Pass:** One account; no duplicate.  
**Fail:** Two accounts with the same username exist.

---

### AUTH-03 — Unauthenticated access to protected routes redirects to login

**Given** no session cookie is set  
**When** a user navigates to `/`, `/pickup`, `/lookup-print`, `/reports`, or `/settings`  
**Then** the browser redirects to `/login`

**Steps:**
1. Clear browser cookies.
2. Navigate directly to each protected route.
3. Confirm each redirects to `/login`.
4. Confirm the original route is preserved as a `?redirect=` or equivalent query param.

**Pass:** All protected routes redirect to login.  
**Fail:** Any route loads without authentication.

---

### AUTH-04 — Login and redirect to intended route

**Given** an unauthenticated user navigated to `/pickup`  
**When** they log in successfully  
**Then** the browser returns them to `/pickup`

**Steps:**
1. Navigate to `/pickup` without a session.
2. Confirm redirect to `/login?redirect=%2Fpickup` (or equivalent).
3. Log in with valid credentials.
4. Confirm redirect to `/pickup`.

**Pass:** Returned to `/pickup` after login.  
**Fail:** Redirected to home or login stays on screen.

---

### AUTH-05 — Unauthenticated API calls return 401

**Given** no session cookie  
**When** a direct `GET /api/orders` call is made (or any protected endpoint)  
**Then** the response status is `401`

**Steps:**
1. In a new browser tab, open DevTools → Network.
2. Navigate to a protected route while unauthenticated.
3. Observe the XHR calls to the API returning `401`.

Or use curl:
```bash
curl -v http://localhost:8080/api/orders
```
Expected: `HTTP/1.1 401`

**Pass:** 401 returned.  
**Fail:** 200 or data returned without session.

---

### AUTH-06 — Wrong-role access returns 403

**Given** a `Pickup` user is logged in  
**When** they call `GET /api/users` (Admin-only endpoint) directly  
**Then** the response status is `403`

**Steps:**
1. Log in as a `Pickup`-only user.
2. In DevTools, execute:
   ```js
   fetch('/api/users', {credentials: 'include'}).then(r => console.log(r.status))
   ```
3. Confirm `403`.

**Pass:** 403 returned.  
**Fail:** 200 returned or user management data leaks.

---

### AUTH-07 — Admin creates a station account

**Given** an Admin is logged in  
**When** they navigate to user management and create a new user `POS2` with role `POS`  
**Then** the new account appears in the user list

**Steps:**
1. Log in as Admin.
2. Navigate to Settings → User Management (or `/admin/users`).
3. Click **Create User**.
4. Enter username `POS2`, password, role `POS`.
5. Save and confirm the user appears in the list.

**Pass:** `POS2` appears with `POS` role and Active status.  
**Fail:** Error on save or user does not appear.

---

### AUTH-08 — Admin disables a user

**Given** a user `POS2` exists and is active  
**When** an Admin clicks **Disable** on that user  
**Then** the user status changes to Inactive

**Steps:**
1. Log in as Admin.
2. Open user management.
3. Click **Disable** on `POS2`.
4. Confirm status shows Inactive.

**Pass:** Status changes to Inactive.  
**Fail:** Action fails or status remains Active.

---

### AUTH-09 — Disabled user cannot log in

**Given** user `POS2` is disabled  
**When** `POS2` attempts to log in  
**Then** the login form shows an error and no session is created

**Steps:**
1. Navigate to `/login`.
2. Enter `POS2` credentials.
3. Confirm an error message appears (e.g., "Account is inactive").
4. Confirm no session cookie is set.

**Pass:** Login rejected with error message.  
**Fail:** Login succeeds or session is created.

---

### AUTH-10 — Admin cannot disable the last active admin

**Given** only one active Admin exists  
**When** the Admin attempts to disable themselves  
**Then** the API returns an error and the account remains active

**Steps:**
1. Ensure only one admin account is active.
2. Try to disable it via user management.
3. Confirm an error message appears.
4. Confirm the account remains active.

**Pass:** Error shown; account remains active.  
**Fail:** Last admin is disabled, locking out the app.

---

### AUTH-11 — Admin resets a station account password

**Given** user `POS2` exists  
**When** an Admin uses **Reset Password** and sets a new password  
**Then** `POS2` can log in with the new password and not the old one

**Steps:**
1. Log in as Admin.
2. Open user management, find `POS2`.
3. Click **Reset Password** and enter a new password.
4. Log out.
5. Log in as `POS2` with the new password.
6. Confirm login succeeds.

**Pass:** New password works; old password rejected.  
**Fail:** New password rejected or old password still works.

---

### AUTH-12 — Role-based frontend access (Pickup user)

**Given** a `Pickup`-only user is logged in  
**When** they navigate the app  
**Then** they can access `/pickup` and `/pickup/:orderId` but not `/settings`, `/reports`, or `/admin/users`

**Steps:**
1. Log in as `Pickup`-role user.
2. Navigate to `/pickup` — confirm access.
3. Navigate to `/settings` — confirm access denied or redirect.
4. Navigate to `/reports` — confirm access denied or redirect.
5. Navigate to `/admin/users` — confirm access denied or redirect.

**Pass:** Pickup route accessible; admin/settings/reports show access denied.  
**Fail:** Any restricted route grants access.

---

### AUTH-13 — Role-based frontend access (Reports user)

**Given** a `Reports`-only user is logged in  
**When** they navigate the app  
**Then** they can access `/reports` but not `/pickup`, `/settings`, or `/admin/users`

**Steps:**
1. Log in as `Reports`-role user.
2. Navigate to `/reports` — confirm access.
3. Navigate to `/pickup` — confirm access denied or redirect.
4. Navigate to `/admin/users` — confirm access denied or redirect.

**Pass:** Reports route accessible; restricted routes show access denied.  
**Fail:** Any restricted route grants access.

---

### AUTH-14 — Logout clears session

**Given** a user is logged in  
**When** they click **Logout**  
**Then** the session cookie is cleared and they are redirected to `/login`

**Steps:**
1. Log in as any user.
2. Click **Logout** in the nav.
3. Confirm redirect to `/login`.
4. Navigate to `/` — confirm redirect back to `/login`.
5. In DevTools, confirm the session cookie is cleared.

**Pass:** Redirected to login; no session cookie present.  
**Fail:** Session persists or user remains logged in.

---

### AUTH-15 — Existing admin PIN flows still work

**Given** an Admin is logged in  
**When** they perform a PIN-protected action (e.g., close sale, force complete)  
**Then** the PIN prompt still appears and the action proceeds on correct PIN

**Steps:**
1. Log in as Admin.
2. Go to Settings and attempt **Close Sale**.
3. Confirm the PIN prompt appears.
4. Enter the admin PIN (default `1234` locally).
5. Confirm the action completes.

**Pass:** PIN prompt appears and action succeeds.  
**Fail:** PIN prompt missing or action blocked.

---

### AUTH-16 — Print routes accessible for desktop workflows

**Given** the auth layer is active  
**When** a desktop user with the appropriate role accesses a print route (e.g., `/print/order/:orderId`)  
**Then** the print view loads without requiring separate re-authentication

**Steps:**
1. Log in as Admin or LookupPrint user.
2. Navigate to an order and click **Print Order Sheet**.
3. Confirm the print page opens or the print dialog appears.
4. Confirm no 401 or login redirect occurs.

**Pass:** Print route renders normally.  
**Fail:** 401 or login redirect on print route.

---

### AUTH-17 — Session expiry forces re-authentication

**Given** a valid session is active  
**When** the session expires (or the cookie is manually cleared)  
**Then** the next API call returns `401` and the frontend redirects to login

**Steps:**
1. Log in and perform a workflow.
2. Clear the session cookie in DevTools.
3. Perform any action that triggers an API call.
4. Confirm a `401` is returned by the API.
5. Confirm the frontend redirects to `/login` without silently ignoring the error.

**Pass:** 401 returned; redirect to login occurs.  
**Fail:** App silently fails or pretends the action succeeded.

---

### AUTH-18 — Kiosk mode still works after auth

**Given** an Admin is logged in  
**When** they enable kiosk mode on a device from Settings  
**Then** the kiosk shell activates and restricts navigation as before

**Steps:**
1. Log in as Admin.
2. Go to Settings → This Device.
3. Enable kiosk mode (Pickup or LookupPrint).
4. Confirm the kiosk shell activates.
5. Confirm the Admin Unlock button is visible.
6. Confirm navigation is restricted to the kiosk-allowed routes.

**Pass:** Kiosk mode activates; navigation restricted.  
**Fail:** Kiosk mode breaks after auth or Admin Unlock disappears.

---

## Role Coverage Matrix

| Route / Action | Admin | Pickup | LookupPrint | POS | Reports |
|---|---|---|---|---|---|
| `/` Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/pickup` | ✓ | ✓ | — | — | — |
| `/pickup/:id` | ✓ | ✓ | — | — | — |
| `/lookup-print` | ✓ | — | ✓ | — | — |
| `/walkup/new` | ✓ | — | — | ✓ | — |
| `/reports` | ✓ | — | — | — | ✓ |
| `/settings` | ✓ | — | — | — | — |
| `/admin/users` | ✓ | — | — | — | — |
| `/orders` | ✓ | — | — | — | ✓ |
| `/imports` | ✓ | — | — | — | — |
| Print routes | ✓ | ✓ | ✓ | — | — |

Note: exact route-to-role mapping is enforced by the backend authorization policies. This matrix reflects the intended design; update if policies differ from implementation.

## API Endpoint Coverage Matrix

| Endpoint | Auth Required | Minimum Role |
|---|---|---|
| `POST /api/auth/login` | No | — |
| `POST /api/auth/logout` | Yes | Any |
| `GET /api/auth/me` | Yes | Any |
| `GET /api/users` | Yes | Admin |
| `POST /api/users` | Yes | Admin |
| `PUT /api/users/:id` | Yes | Admin |
| `POST /api/users/:id/reset-password` | Yes | Admin |
| `GET /api/orders` | Yes | Any |
| `GET /api/fulfillment/*` | Yes | Pickup |
| `GET /api/reports/*` | Yes | Reports or Admin |
| `GET /api/settings` | Yes | Any |
| `PUT /api/settings` | Yes | Admin |

## Acceptance Criteria Checklist

- [ ] AC-1: README documents first-admin environment/configuration values
- [ ] AC-2: Docs describe initial role meanings and recommended station account naming
- [ ] AC-3: Fresh environment can start, bootstrap first admin, log in, create a station user, log out
- [ ] AC-4: Existing desktop pickup, lookup/print, reports, settings, and kiosk flows remain usable
- [ ] AC-5: Unauthenticated API calls to protected endpoints return `401`; wrong-role calls return `403`
- [ ] AC-6: Existing print routes remain usable for desktop print workflows
- [ ] AC-7: `cd api && dotnet test HamptonHawksPlantSales.sln` passes
- [ ] AC-8: `cd web && npm run build` passes
