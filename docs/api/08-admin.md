# Admin API

## Surface Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/reports` | Session required | List reporter's own reports |
| `POST` | `/api/reports` | Session required | File a report against a user or message |
| `GET` | `/api/admin/reports` | Admin session | List all reports (optional status filter) |
| `GET` | `/api/admin/reports/[id]` | Admin session | Get a single report |
| `PATCH` | `/api/admin/reports/[id]` | Admin session | Resolve or update a report |
| `GET` | `/api/admin/audit-logs` | Admin session | List audit log entries (paginated) |
| `POST` | `/api/admin/audit-logs` | Service role key | Create an audit log entry |

---

## GET /api/reports

**Auth:** Session cookie required

**Description:** Returns the authenticated user's own submitted reports. RLS enforces reporter-only visibility.

**Success 200:**
```json
[
  {
    "id": "uuid",
    "reporter_id": "uuid",
    "reported_user_id": "uuid | null",
    "reported_message_id": "uuid | null",
    "reason": "spam",
    "detail": "string | null",
    "status": "pending",
    "admin_notes": null,
    "resolved_by": null,
    "resolved_at": null,
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/reports

**Auth:** Session cookie required

**Description:** Files a report against a user or a message. At least one of `reported_user_id` or `reported_message_id` must be provided.

**Request body:**
```json
{
  "reported_user_id": "uuid",
  "reported_message_id": "uuid",
  "reason": "spam | harassment | fake_profile | inappropriate_content | underage_concern | other",
  "detail": "optional free text"
}
```

**Success 201:** Created report object (same shape as GET)

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | `reason` not provided |
| 400 | MISSING_TARGET | Neither `reported_user_id` nor `reported_message_id` provided |
| 401 | UNAUTHENTICATED | No valid session |

---

## GET /api/admin/reports

**Auth:** Admin session required (`role = 'admin'`)

**Description:** Returns all reports. Supports optional status filter via query param.

**Query params:**
| Param | Values | Default |
|-------|--------|---------|
| `status` | `pending \| under_review \| resolved \| dismissed` | all statuses |

**Success 200:** Array of report objects

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Authenticated but not admin |

---

## GET /api/admin/reports/[id]

**Auth:** Admin session required

**Description:** Returns a single report by ID.

**Success 200:** Report object

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Not admin |
| 404 | REPORT_NOT_FOUND | Report does not exist |

---

## PATCH /api/admin/reports/[id]

**Auth:** Admin session required

**Description:** Resolves or updates a report. Sets `resolved_by` and `resolved_at` automatically.

**Request body:**
```json
{
  "status": "under_review | resolved | dismissed",
  "admin_notes": "optional string"
}
```

**Success 200:** Updated report object

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | `status` not provided |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Not admin |
| 404 | REPORT_NOT_FOUND | Report does not exist |

---

## GET /api/admin/audit-logs

**Auth:** Admin session required

**Description:** Returns audit log entries in descending chronological order. Supports pagination.

**Query params:**
| Param | Type | Default |
|-------|------|---------|
| `limit` | integer | 50 |
| `offset` | integer | 0 |

**Success 200:**
```json
[
  {
    "id": "uuid",
    "actor_id": "uuid | null",
    "action": "user.suspended",
    "target_type": "user",
    "target_id": "uuid",
    "metadata": {},
    "ip_address": "string | null",
    "created_at": "ISO 8601"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Not admin |

---

## POST /api/admin/audit-logs

**Auth:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` — internal service use only

**Description:** Creates an audit log entry. Called internally by admin actions and background jobs. The `audit_logs` table has no client-facing INSERT RLS policy; this endpoint uses the service role.

**Request body:**
```json
{
  "actor_id": "uuid | null",
  "action": "user.suspended",
  "target_type": "user",
  "target_id": "uuid",
  "metadata": {},
  "ip_address": "string"
}
```

**Success 201:** Created audit log entry

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | `action`, `target_type`, or `target_id` missing |
| 401 | UNAUTHENTICATED | Missing or invalid service role key |
