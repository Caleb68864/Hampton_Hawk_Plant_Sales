---
type: phase-spec-index
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
date: 2026-05-05
sub_specs: 6
---

# User Authentication and Roles -- Phase Specs

Refined from [2026-05-05-user-authentication-and-roles.md](../2026-05-05-user-authentication-and-roles.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Backend User Model, Roles, and Bootstrap Admin | none | [sub-spec-1-backend-user-model-roles-and-bootstrap-admin.md](sub-spec-1-backend-user-model-roles-and-bootstrap-admin.md) |
| 2 | Authentication Endpoints, Cookie Session, and Policies | 1 | [sub-spec-2-authentication-endpoints-cookie-session-and-policies.md](sub-spec-2-authentication-endpoints-cookie-session-and-policies.md) |
| 3 | Backend Route Protection and Admin User Management API | 2 | [sub-spec-3-backend-route-protection-and-admin-user-management-api.md](sub-spec-3-backend-route-protection-and-admin-user-management-api.md) |
| 4 | Frontend Auth Client, Store, Login, and Route Guards | 2 | [sub-spec-4-frontend-auth-client-store-login-and-route-guards.md](sub-spec-4-frontend-auth-client-store-login-and-route-guards.md) |
| 5 | Admin User Management UI and Desktop Integration | 3, 4 | [sub-spec-5-admin-user-management-ui-and-desktop-integration.md](sub-spec-5-admin-user-management-ui-and-desktop-integration.md) |
| 6 | End-to-End Auth Hardening and Documentation | 5 | [sub-spec-6-end-to-end-auth-hardening-and-documentation.md](sub-spec-6-end-to-end-auth-hardening-and-documentation.md) |

## Execution

Run `/forge-run docs/specs/user-authentication-and-roles/` to execute all phase specs.

Run `/forge-run docs/specs/user-authentication-and-roles/ --sub N` to execute a single sub-spec.

