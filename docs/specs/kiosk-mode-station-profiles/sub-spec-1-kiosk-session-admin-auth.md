---
type: phase-spec
sub_spec: 1
title: "Device-Local Kiosk Session + Admin Authorization"
master_spec: "docs/specs/2026-03-06-kiosk-mode-station-profiles.md"
dependencies: []
---

# Sub-Spec 1: Device-Local Kiosk Session + Admin Authorization

## Shared Context

See [master spec](../2026-03-06-kiosk-mode-station-profiles.md).

This phase establishes the architectural decision that kiosk mode is local to one browser profile and not part of global app settings. The only server responsibility in this phase is to validate that an admin PIN is real before the browser is allowed to persist or clear kiosk state.

The current code already has the pieces to build on:
- `web/src/stores/authStore.ts` exposes a promise-based PIN modal flow.
- `web/src/pages/SettingsPage.tsx` is the natural admin entry point, but currently only controls global `Sale Closed`.
- `api/src/HamptonHawksPlantSales.Api/Filters/AdminPinActionFilter.cs` already validates headers and allows GET requests without a reason header.
- `api/tests/HamptonHawksPlantSales.Tests/Services/` contains the established xUnit + Moq controller/filter test pattern.

## Codebase Analysis

### Existing Files

- `web/src/pages/SettingsPage.tsx` already loads settings, displays a single card, and uses `requestAdminAuth()` for mutating actions.
- `web/src/stores/authStore.ts` and `web/src/hooks/useAdminAuth.ts` already expose a reusable promise-based modal pattern.
- `web/src/components/shared/AdminPinModal.tsx` currently assumes every admin action requires both PIN and reason.
- `api/src/HamptonHawksPlantSales.Api/Controllers/AdminActionsController.cs` is thin and returns `ApiResponse<T>.Ok(...)` envelopes.
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/AdminService.cs` currently logs admin actions and queries them, but does not expose a verification method.
- `api/tests/HamptonHawksPlantSales.Tests/Services/AdminActionsControllerTests.cs` and `AdminPinActionFilterTests.cs` are the closest backend test references.

### Patterns To Follow

- Thin controllers only; service layer owns logic.
- Frontend state lives in small Zustand stores with direct action methods.
- Modal-driven admin authorization is promise-based rather than callback-heavy.
- API helpers in `web/src/api/` are small files per domain, built on the shared client wrapper.
- Frontend node-based tests can be run directly with `node --test --experimental-strip-types ...` without wiring new files into `npm test`.

### Test Location

- Backend: `api/tests/HamptonHawksPlantSales.Tests/Services/`
- Frontend pure helpers/store normalization: `web/src/stores/*.test.ts` and `web/src/api/*.test.ts`

### Interfaces This Phase Must Provide

- A persisted kiosk session model and store that other phases can read synchronously.
- A minimal API contract for validating an admin PIN before local kiosk activation/deactivation.
- A Settings UI contract for choosing a profile and toggling kiosk mode on the current device.

## Implementation Steps

### Step 1: Add a minimal backend PIN verification contract

**Test first**
- Extend `api/tests/HamptonHawksPlantSales.Tests/Services/AdminActionsControllerTests.cs` with a controller test for a new `VerifyPin()` action that returns an `ApiResponse<AdminPinValidationResponse>` envelope.
- Extend `api/tests/HamptonHawksPlantSales.Tests/Services/AdminPinActionFilterTests.cs` with a coverage check that the new endpoint is decorated with `[RequiresAdminPin]` and works as a GET without a reason header.

**Run to confirm failure**
```powershell
Set-Location api
 dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AdminActionsControllerTests|FullyQualifiedName~AdminPinActionFilterTests"
```

**Implement**
- Add `AdminPinValidationResponse` to `api/src/HamptonHawksPlantSales.Core/DTOs/AdminDtos.cs`.
- Add `Task<AdminPinValidationResponse> ValidatePinAsync()` to `api/src/HamptonHawksPlantSales.Core/Interfaces/IAdminService.cs`.
- Implement `ValidatePinAsync()` in `api/src/HamptonHawksPlantSales.Infrastructure/Services/AdminService.cs`. The method can return a simple success payload with `ValidatedAt` and does not need to write an audit record.
- Add `GET /api/admin-actions/verify-pin` to `api/src/HamptonHawksPlantSales.Api/Controllers/AdminActionsController.cs`, decorated with `[RequiresAdminPin]`, returning `ApiResponse<AdminPinValidationResponse>.Ok(...)`.

**Run to verify pass**
```powershell
Set-Location api
 dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AdminActionsControllerTests|FullyQualifiedName~AdminPinActionFilterTests"
```

**Commit**
- `feat: add admin PIN verification endpoint for kiosk mode`

---

### Step 2: Add frontend admin API helpers for kiosk authorization

**Test first**
- Create `web/src/api/admin.test.ts` covering the request shape for `verifyPin(pin)` and any helper used to attach PIN headers.

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/api/admin.test.ts
```

**Implement**
- Create `web/src/api/admin.ts`.
- Add a `verifyPin(pin: string)` helper that calls `GET /api/admin-actions/verify-pin` and sends the PIN in `X-Admin-Pin`.
- If needed, extract a tiny shared helper for admin headers so kiosk mode can reuse the same header construction pattern as other admin actions later.

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/api/admin.test.ts
```

**Commit**
- `feat: add frontend admin PIN verification api`

---

### Step 3: Define kiosk types and pure normalization helpers

**Test first**
- Create `web/src/stores/kioskSession.test.ts` to cover:
  - accepted profiles (`pickup`, `lookup-print`)
  - malformed stored data falling back to disabled mode
  - future-proof parsing that ignores unknown fields safely

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/stores/kioskSession.test.ts
```

**Implement**
- Create `web/src/types/kiosk.ts` with:
  - `KioskProfile`
  - `KioskSession`
  - `DEFAULT_KIOSK_STORAGE_KEY`
- Create `web/src/stores/kioskSession.ts` with pure helpers such as:
  - `isKioskProfile(value)`
  - `normalizeStoredKioskSession(value)`
  - `buildKioskSessionDraft(profile, workstationName, preferFullscreen)`

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/stores/kioskSession.test.ts
```

**Commit**
- `feat: add kiosk session types and normalization helpers`

---

### Step 4: Create the persisted kiosk store

**Test first**
- Extend `web/src/stores/kioskSession.test.ts` or add `web/src/stores/kioskStore.test.ts` to cover the store action contracts:
  - activate with valid draft data
  - deactivate clears session
  - hydration from malformed storage disables kiosk instead of crashing

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/stores/kioskStore.test.ts
```

**Implement**
- Create `web/src/stores/kioskStore.ts` using Zustand plus `persist` middleware.
- Store shape should include:
  - `session`
  - `isKioskEnabled`
  - `activateKiosk(session)`
  - `deactivateKiosk()`
  - `replaceSession(session)`
- Keep persistence browser-local via `localStorage`; do not call the API to save kiosk state.
- Include a migration/version hook or normalization pass so stale local data does not break boot.

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/stores/kioskStore.test.ts
```

**Commit**
- `feat: add persisted kiosk store`

---

### Step 5: Make the admin PIN modal usable for verify-only flows

**Test first**
- Add `web/src/components/shared/AdminPinModal.test.ts` or a pure props/helper test if you extract modal state helpers.
- Cover the case where a flow requires PIN but does not require a reason.

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/components/shared/AdminPinModal.test.ts
```

**Implement**
- Update `web/src/components/shared/AdminPinModal.tsx` and `web/src/stores/authStore.ts` to support a modal configuration object.
- Support both existing mutating flows and new verify-only flows with options such as:
  - `requireReason`
  - `title`
  - `confirmLabel`
  - `reasonLabel`
- Preserve current behavior for sale-closed toggles and other existing admin actions.

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/components/shared/AdminPinModal.test.ts
```

**Commit**
- `feat: make admin PIN modal configurable for kiosk activation`

---

### Step 6: Extend Settings with a device-local kiosk section

**Test first**
- Add a focused UI/state test if practical for the pure helpers that drive the device-local settings card.
- At minimum, add a regression test for any extracted helper that determines whether kiosk mode can be activated or deactivated.

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/pages/settings/kioskSettingsState.test.ts
```

**Implement**
- Extend `web/src/pages/SettingsPage.tsx` with a second card titled `This Device` or `Kiosk Mode (This Browser)`.
- Add fields for:
  - station profile select (`Pickup`, `Lookup & Print`)
  - workstation name
  - optional `Prefer fullscreen` checkbox
- Activation flow:
  1. collect PIN using `requestAdminAuth({ requireReason: false, ... })`
  2. call `adminApi.verifyPin(pin)`
  3. persist kiosk session through `kioskStore.activateKiosk(...)`
- Deactivation flow:
  1. collect PIN
  2. call `adminApi.verifyPin(pin)`
  3. `kioskStore.deactivateKiosk()`
- Keep `Sale Status` visually separate and clearly labeled as global.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Manual acceptance check**
1. Open Settings in a normal browser.
2. Verify the page shows distinct `Sale Status` and `This Device` sections.
3. Enter a bad PIN and confirm kiosk mode does not activate.
4. Enter a valid PIN and confirm kiosk mode state persists after refresh.

**Commit**
- `feat: add device-local kiosk controls to settings`

## Interface Contracts

### Provides

#### Backend API
- `GET /api/admin-actions/verify-pin`
- Headers:
  - `X-Admin-Pin` required
  - `X-Admin-Reason` not required because this is a GET
- Response envelope:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "validatedAt": "2026-03-06T18:00:00Z"
  },
  "errors": []
}
```

#### Frontend Store Contract
- `kioskStore.session: KioskSession | null`
- `kioskStore.isKioskEnabled: boolean`
- `kioskStore.activateKiosk(session: KioskSession): void`
- `kioskStore.deactivateKiosk(): void`

#### Frontend Types
```ts
export type KioskProfile = 'pickup' | 'lookup-print';

export interface KioskSession {
  enabled: true;
  profile: KioskProfile;
  workstationName: string;
  enabledAt: string;
  preferFullscreen: boolean;
}
```

### Requires

- Existing `AdminPinActionFilter` semantics for validating `X-Admin-Pin`.
- Existing `AdminPinModal` promise-based flow, extended rather than replaced.
- No server persistence for kiosk session state.

### Shared State

- `SettingsPage` becomes the only supported entry point for enabling or disabling kiosk mode.
- `kioskStore` is the state source that sub-spec 2 will use for route enforcement.
- The modal configuration updates must remain backward-compatible with sale-closed toggling and fulfillment admin flows.

### Verification For Dependents

Sub-spec 2 can begin when the following are true:
- activating kiosk in Settings persists a valid `KioskSession`
- reloading the browser preserves the session
- invalid stored session data is normalized to disabled mode
- `adminApi.verifyPin(pin)` fails cleanly on bad PINs and succeeds on valid ones

## Verification Commands

### Focused backend
```powershell
Set-Location api
 dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AdminActionsControllerTests|FullyQualifiedName~AdminPinActionFilterTests"
```

### Focused frontend helper tests
```powershell
Set-Location web
 node --test --experimental-strip-types src/api/admin.test.ts src/stores/kioskSession.test.ts src/stores/kioskStore.test.ts src/components/shared/AdminPinModal.test.ts
```

### Build checks
```powershell
Set-Location web
 npm run build
```

```powershell
Set-Location api
 dotnet build HamptonHawksPlantSales.sln --no-restore -v minimal
```

### Acceptance checks
- Settings can validate a PIN through the API without mutating any global app setting.
- Kiosk activation changes only the current browser's local state.
- Refresh preserves kiosk state.
- Invalid persisted kiosk state does not crash the app on boot.
