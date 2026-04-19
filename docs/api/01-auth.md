# Auth API — Contract Reference

All responses use `Content-Type: application/json`.  
All error responses use shape: `{ "error": { "code": string, "message": string } }`.  
The UI pattern-matches on `error.code`, not HTTP status alone.

Session is managed via HTTP-only cookies set by Supabase SSR — the UI does not handle tokens directly.

---

## Surface Summary

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| `POST` | `/api/auth/signup` | No | Register with email + password |
| `POST` | `/api/auth/login` | No | Sign in; sets session cookie |
| `POST` | `/api/auth/logout` | Yes | Clear session cookie |
| `GET` | `/api/auth/callback` | No | Supabase redirect handler (email verify + password reset) |
| `POST` | `/api/auth/password-reset` | No | Request password reset link |
| `POST` | `/api/auth/password-update` | Recovery session | Set new password after reset |
| `POST` | `/api/auth/role` | Yes | Permanently lock user role (once only) |
| `GET` | `/api/auth/me` | Yes | Return current user's safe fields |

---

## POST /api/auth/signup

**Auth:** Not required  
**Description:** Registers a new user. Always returns the same message regardless of whether the email already exists — this prevents user enumeration.

**Request body:**
```json
{ "email": "user@example.com", "password": "ValidPass1!" }
```

**Password rules (enforced server-side):**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 symbol (non-alphanumeric character)

**Success `200`:**
```json
{ "message": "Check your email to verify your account" }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `email` or `password` not provided |
| 400 | `WEAK_PASSWORD` | Password does not meet requirements |

---

## POST /api/auth/login

**Auth:** Not required  
**Description:** Signs in with email and password. Sets a session cookie on success.

**Request body:**
```json
{ "email": "user@example.com", "password": "ValidPass1!" }
```

**Success `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "athlete | team | brand | agent | admin | null",
    "role_locked_at": "2026-04-19T00:00:00Z | null",
    "email_verified": true,
    "terms_accepted_at": "2026-04-19T00:00:00Z | null",
    "deactivated_at": null,
    "deletion_scheduled_at": null
  }
}
```

**UI logic:** If `role === null || role_locked_at === null`, redirect to role selection screen.

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `email` or `password` not provided |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |

---

## POST /api/auth/logout

**Auth:** Session cookie required  
**Description:** Signs out the current user and clears the session cookie.

**Request body:** None

**Success `200`:**
```json
{ "success": true }
```

---

## GET /api/auth/callback

**Auth:** Not required  
**Description:** Handles Supabase auth redirects. Do not call this directly — Supabase redirects to this URL after email verification or password reset. The UI should never construct this URL.

**Query params set by Supabase:**
- `code` — PKCE exchange code
- `type` — `email_confirmation` or `recovery`

**On success:** Redirects to `/role-select` (email confirmation) or `/update-password` (recovery).  
**On failure:** Redirects to `/login?error=auth_callback_failed`.

---

## POST /api/auth/password-reset

**Auth:** Not required  
**Description:** Sends a password reset link. Always returns the same message regardless of whether the email exists — prevents user enumeration.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Success `200` (always):**
```json
{ "message": "If this email exists, you will receive a reset link" }
```

Reset link expires after **1 hour**.

---

## POST /api/auth/password-update

**Auth:** Recovery session required (user must have clicked the reset link)  
**Description:** Sets a new password during the password reset flow. Validates strength server-side.

**Request body:**
```json
{ "password": "NewValidPass1!" }
```

**Success `200`:**
```json
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `password` not provided |
| 400 | `WEAK_PASSWORD` | Password does not meet requirements |
| 400 | `PASSWORD_UPDATE_FAILED` | Supabase rejected the update |
| 401 | `UNAUTHENTICATED` | No valid recovery session |

---

## POST /api/auth/role

**Auth:** Session cookie required  
**Description:** Permanently locks the user's role. Can only be called once per account — role cannot be changed after this call succeeds. Admin role cannot be selected via this endpoint (admin accounts are created out-of-band).

**Request body:**
```json
{ "role": "athlete | team | brand | agent" }
```

**Success `200`:**
```json
{ "role": "athlete" }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `role` not provided |
| 400 | `INVALID_ROLE` | Value not in `['athlete', 'team', 'brand', 'agent']` |
| 400 | `ROLE_ALREADY_LOCKED` | Role was previously set — cannot change |
| 401 | `UNAUTHENTICATED` | No valid session |

---

## GET /api/auth/me

**Auth:** Session cookie required  
**Description:** Returns the current user's safe fields. Call this on app load to determine whether to show the role selection screen or the main dashboard.

**Success `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "athlete | team | brand | agent | admin | null",
  "role_locked_at": "ISO 8601 timestamp | null",
  "email_verified": true,
  "terms_accepted_at": "ISO 8601 timestamp | null",
  "deactivated_at": "ISO 8601 timestamp | null",
  "deletion_scheduled_at": "ISO 8601 timestamp | null"
}
```

**UI routing logic:**
- `!email_verified` → show "check your email" screen
- `role === null || role_locked_at === null` → show role selection screen
- `deactivated_at !== null` → show reactivation prompt
- `deletion_scheduled_at !== null` → show "account scheduled for deletion" banner
- Otherwise → proceed to role-appropriate dashboard

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | `UNAUTHENTICATED` | No valid session |
