# Notifications API

Manages `notification_logs` — in-app and channel notifications for users.

## RLS

- `SELECT`: own records only (user client)
- `INSERT`: service role only (admin client)
- No `UPDATE` / `DELETE`

`markRead` uses the user client and relies on RLS to scope updates to own records.

---

## Lib — `lib/supabase/notifications.ts`

| Function | Signature | Auth |
|---|---|---|
| `getNotifications` | `(supabase, userId) → NotificationLogRow[]` | User client |
| `getNotification` | `(supabase, notificationId) → NotificationLogRow \| null` | User client |
| `markRead` | `(supabase, notificationId) → NotificationLogRow` | User client |
| `createNotification` | `(adminSupabase, payload) → NotificationLogRow` | Admin client |

### Error codes

| Code | Meaning |
|---|---|
| `NOTIFICATIONS_FETCH_FAILED` | DB error on list fetch |
| `NOTIFICATION_FETCH_FAILED` | DB error on single fetch |
| `NOTIFICATION_NOT_FOUND` | `markRead` — notification missing or not owned |
| `NOTIFICATION_UPDATE_FAILED` | `markRead` — DB error on update |
| `NOTIFICATION_CREATE_FAILED` | `createNotification` — DB error on insert |

---

## Routes

### `GET /api/notifications`

Returns all notifications for the authenticated user, ordered newest first.

**Auth:** Session cookie required.

**Response 200**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "event_type": "connection_request_received",
    "channel": "in_app",
    "title": "New connection request",
    "body": "Someone wants to connect with you",
    "metadata": {},
    "sent_at": "2026-04-20T10:00:00Z",
    "read_at": null,
    "created_at": "2026-04-20T10:00:00Z"
  }
]
```

**Response 401** — not authenticated

---

### `PATCH /api/notifications/[id]/read`

Marks a notification as read by setting `read_at` to the current UTC timestamp.
RLS ensures users can only mark their own notifications.

**Auth:** Session cookie required.

**Response 200** — updated notification object

**Response 401** — not authenticated

**Response 404** — notification not found or not owned (`NOTIFICATION_NOT_FOUND`)

---

### `POST /api/notifications`

Internal endpoint for server-side notification creation. Requires service role key.
Used by webhook handlers and other API routes to fan out notifications.

**Auth:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header required.

**Request body**
```json
{
  "user_id": "uuid",
  "event_type": "payment_received",
  "channel": "in_app",
  "title": "Payment received",
  "body": "Your payment of £500 has been received",
  "metadata": {}
}
```

Required fields: `user_id`, `event_type`, `channel`, `title`, `body`.

**Response 201** — created notification object

**Response 400** — missing required fields (`MISSING_FIELDS`)

**Response 401** — missing or invalid service role key (`UNAUTHENTICATED`)

---

## Notification channels

| Channel | Description |
|---|---|
| `in_app` | Displayed in the app; supports `read_at` |
| `email` | Email dispatch; `read_at` not used |
| `push` | Push notification; `read_at` not used |
