# 04 — Messaging API

## Surface Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/messaging/matches` | required | List active matches for current user |
| `GET` | `/api/messaging/matches/[matchId]/messages` | required | List non-deleted messages for a match |
| `POST` | `/api/messaging/matches/[matchId]/messages` | required | Send a message in a match |
| `DELETE` | `/api/messaging/matches/[matchId]/messages/[messageId]` | required | Soft-delete a message (sender only) |

---

## GET /api/messaging/matches

**Auth:** Session cookie required  
**Description:** Returns all active matches where the authenticated user is a participant.

**Success 200:**
```json
[
  {
    "id": "uuid",
    "user_a_id": "uuid",
    "user_b_id": "uuid",
    "status": "active",
    "proposal_required": true,
    "proposal_sent": false,
    "matched_at": "2026-04-19T00:00:00Z",
    "connection_request_id": "uuid | null",
    "created_at": "2026-04-19T00:00:00Z",
    "updated_at": "2026-04-19T00:00:00Z"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHENTICATED | No valid session |

---

## GET /api/messaging/matches/[matchId]/messages

**Auth:** Session cookie required  
**Description:** Returns all non-deleted messages for a match, ordered by `sent_at` ascending. Caller must be a participant in the match.

**Success 200:**
```json
[
  {
    "id": "uuid",
    "match_id": "uuid",
    "sender_id": "uuid",
    "content_type": "text | image | video | document | proposal_card | esignature_request | payment_confirmation",
    "text_content": "string | null",
    "attachment_url": "string | null",
    "attachment_size_bytes": "number | null",
    "attachment_mime_type": "string | null",
    "metadata": {},
    "is_deleted": false,
    "deleted_at": null,
    "sent_at": "2026-04-19T00:00:00Z",
    "created_at": "2026-04-19T00:00:00Z"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | MATCH_NOT_FOUND | Match does not exist or caller is not a participant |

---

## POST /api/messaging/matches/[matchId]/messages

**Auth:** Session cookie required  
**Description:** Sends a message in a match. If the match has `proposal_required = true` and `proposal_sent = false`, only `proposal_card` messages are allowed. Sending a `proposal_card` flips `proposal_sent = true`, unlocking free-text.

**Request body:**
```json
{
  "content_type": "text | image | video | document | proposal_card | esignature_request | payment_confirmation",
  "text_content": "string (optional)",
  "attachment_url": "string (optional)",
  "attachment_size_bytes": "number (optional)",
  "attachment_mime_type": "string (optional)",
  "metadata": {} 
}
```

`metadata` carries structured payloads for `proposal_card`, `esignature_request`, and `payment_confirmation` types.

**Success 201:**
```json
{
  "id": "uuid",
  "match_id": "uuid",
  "sender_id": "uuid",
  "content_type": "text",
  "text_content": "Hello!",
  "sent_at": "2026-04-19T00:00:00Z",
  "created_at": "2026-04-19T00:00:00Z"
}
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 400 | MISSING_FIELDS | `content_type` not provided |
| 400 | INVALID_CONTENT_TYPE | `content_type` not a valid enum value |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | PROPOSAL_REQUIRED | Match requires a `proposal_card` before free-text |
| 404 | MATCH_NOT_FOUND | Match does not exist or caller is not a participant |

---

## DELETE /api/messaging/matches/[matchId]/messages/[messageId]

**Auth:** Session cookie required  
**Description:** Soft-deletes a message. Only the sender can delete their own messages. Sets `is_deleted = true` and records `deleted_at`. Deleted messages are excluded from `GET /messages` responses (admin-only via RLS).

**Success 200:**
```json
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | MESSAGE_NOT_FOUND | Message not found or caller is not the sender |
