# Profiles API — Contract Reference

All responses use `Content-Type: application/json`.  
All error responses use shape: `{ "error": { "code": string, "message": string } }`.  
The UI pattern-matches on `error.code`, not HTTP status alone.

Session is managed via HTTP-only cookies — the same auth session as `01-auth.md`.

---

## Surface Summary

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/profiles/me` | Yes | Get own profile |
| `POST` | `/api/profiles/me` | Yes | Create own profile (first time) |
| `PATCH` | `/api/profiles/me` | Yes | Update own profile fields |
| `POST` | `/api/profiles/me/publish` | Yes | Publish profile (set status → active) |
| `GET` | `/api/profiles/:userId` | No | Get a public active profile |
| `GET` | `/api/profiles/representation` | Yes | List own representation links |
| `POST` | `/api/profiles/representation` | Yes (agent) | Create representation link |
| `PATCH` | `/api/profiles/representation/:linkId` | Yes | Accept or decline a representation link |

---

## GET /api/profiles/me

**Auth:** Session cookie required  
**Description:** Returns the current user's profile. The profile type returned depends on their locked role (`athlete_profiles`, `team_profiles`, `brand_profiles`, or `agent_profiles`).

**Success `200`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "draft | active | pending_approval | ...",
  "display_name": "string | null",
  ...
}
```
_Full field list matches the relevant profile table schema (see `docs/superpowers/specs/…` section 02-profiles)._

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `ROLE_NOT_SET` | User has not selected a role yet |
| 401 | `UNAUTHENTICATED` | No valid session |
| 404 | `PROFILE_NOT_FOUND` | Profile has not been created yet |

---

## POST /api/profiles/me

**Auth:** Session cookie required  
**Description:** Creates the user's profile for the first time. Role must be locked before this can be called. The body fields depend on the user's role.

**Request body (athlete example):**
```json
{
  "display_name": "Alice Smith",
  "primary_sport": "Tennis",
  "home_city": "London",
  "home_country": "GB"
}
```

**Request body (brand example):**
```json
{
  "company_name": "Acme Sports",
  "linkedin_url": "https://linkedin.com/company/acme-sports"
}
```
_`company_name` and `linkedin_url` are required for brand profiles (NOT NULL in schema)._

**Success `201`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "draft",
  ...
}
```
_Brands start at `status: "pending_approval"` instead of `"draft"`._

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `ROLE_NOT_LOCKED` | Role must be locked before creating a profile |
| 401 | `UNAUTHENTICATED` | No valid session |
| 409 | `PROFILE_ALREADY_EXISTS` | A profile already exists for this user |

---

## PATCH /api/profiles/me

**Auth:** Session cookie required  
**Description:** Partially updates the user's profile. Only provided fields are updated. Role must be set.

**Request body (any subset of profile fields):**
```json
{
  "display_name": "Alice Smith",
  "level": "amateur",
  "home_city": "Manchester"
}
```

**Success `200`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "display_name": "Alice Smith",
  ...
}
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `ROLE_NOT_SET` | User has not selected a role yet |
| 401 | `UNAUTHENTICATED` | No valid session |
| 404 | `PROFILE_NOT_FOUND` | Profile has not been created yet |

---

## POST /api/profiles/me/publish

**Auth:** Session cookie required  
**Description:** Sets the profile status to `active`, making it visible in discovery. Only available for athletes, teams, and agents. Brand profiles require admin approval and cannot be published via this endpoint.

**Request body:** None

**Success `200`:**
```json
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `ROLE_NOT_SET` | User has not selected a role yet |
| 400 | `BRAND_NOT_PUBLISHABLE` | Brand profiles require admin approval |
| 401 | `UNAUTHENTICATED` | No valid session |

---

## GET /api/profiles/:userId

**Auth:** Not required  
**Description:** Returns a single active profile by user ID. The `role` query parameter is required to determine which profile table to query. Returns 404 for profiles that are not active (RLS-enforced for non-owners).

**Query parameters:**
- `role` _(required)_ — `athlete | team | brand | agent`

**Example:** `GET /api/profiles/abc123?role=athlete`

**Success `200`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "active",
  "display_name": "Alice Smith",
  ...
}
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_ROLE` | `role` query param not provided |
| 400 | `INVALID_ROLE` | `role` value is not one of the valid options |
| 404 | `PROFILE_NOT_FOUND` | Profile not found or not active |

---

## GET /api/profiles/representation

**Auth:** Session cookie required  
**Description:** Returns all representation links where the current user is the client. Agents who want to see links they initiated should use this endpoint as the linked athlete/team.

**Success `200`:**
```json
[
  {
    "id": "uuid",
    "agent_id": "uuid",
    "client_user_id": "uuid",
    "client_role": "athlete",
    "status": "pending | active | terminated",
    "can_edit_profile": false,
    "can_message": false,
    "can_sign_contracts": false,
    "requested_at": "ISO 8601",
    "accepted_at": "ISO 8601 | null",
    "terminated_at": "ISO 8601 | null"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | `UNAUTHENTICATED` | No valid session |

---

## POST /api/profiles/representation

**Auth:** Session cookie required (agent role required)  
**Description:** Agent creates a representation link request for a client (athlete or team). The agent's profile must exist.

**Request body:**
```json
{
  "client_user_id": "uuid",
  "client_role": "athlete | team"
}
```

**Success `201`:**
```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "client_user_id": "uuid",
  "client_role": "athlete",
  "status": "pending",
  "can_edit_profile": false,
  "can_message": false,
  "can_sign_contracts": false,
  "requested_at": "ISO 8601"
}
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `client_user_id` or `client_role` not provided |
| 400 | `INVALID_CLIENT_ROLE` | `client_role` must be `athlete` or `team` |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` | User is not an agent |
| 404 | `AGENT_PROFILE_NOT_FOUND` | Agent has not created a profile yet |

---

## PATCH /api/profiles/representation/:linkId

**Auth:** Session cookie required  
**Description:** Client responds to a representation link request. The `accept` field determines whether to activate or terminate the link. Only the client on the link can respond.

**Request body:**
```json
{ "accept": true }
```

**Success `200`:**
```json
{ "success": true }
```

_When `accept: true`, link `status` → `active` and `accepted_at` is set._  
_When `accept: false`, link `status` → `terminated` and `terminated_at` is set._

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `MISSING_FIELDS` | `accept` field not provided |
| 401 | `UNAUTHENTICATED` | No valid session |
