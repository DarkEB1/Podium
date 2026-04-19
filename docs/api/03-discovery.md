# API Contract — 03 Discovery

## Surface Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/discovery/listings` | required | Browse all accessible listings (RLS: active + own drafts) |
| `POST` | `/api/discovery/listings` | brand only | Create a new job listing (draft) |
| `GET` | `/api/discovery/listings/[listingId]` | required | Get a single listing |
| `PATCH` | `/api/discovery/listings/[listingId]` | brand owner | Update listing fields |
| `POST` | `/api/discovery/listings/[listingId]/publish` | brand owner | Publish listing (draft → active only) |
| `POST` | `/api/discovery/connections` | required | Send a connection request |
| `PATCH` | `/api/discovery/connections/[requestId]` | required | Accept, decline, or withdraw a request |
| `GET` | `/api/discovery/shortlist` | required | Get own shortlist |
| `POST` | `/api/discovery/shortlist` | required | Add user to shortlist |
| `DELETE` | `/api/discovery/shortlist/[targetUserId]` | required | Remove from shortlist (idempotent) |
| `GET` | `/api/discovery/blocks` | required | Get own block list |
| `POST` | `/api/discovery/blocks` | required | Block a user |
| `DELETE` | `/api/discovery/blocks/[blockedId]` | required | Unblock a user (idempotent) |

---

## GET /api/discovery/listings

**Auth:** Session cookie required  
**Description:** Returns all listings visible to the authenticated user. RLS enforces: active listings are public; brands additionally see their own drafts.

**Success 200:**
```ts
JobListing[]
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/discovery/listings

**Auth:** Session cookie required — brand role only  
**Description:** Creates a new job listing in `draft` status. `status`, `id`, `brand_id`, `created_at`, and `updated_at` are protected and stripped from the request body.

**Request body:**
```ts
{
  title: string
  type: "athlete_endorsement" | "team_sponsorship"
  description?: string
  sport_required?: string
  level_required?: string
  location?: string
  is_remote?: boolean
  pay_amount?: number
  pay_currency?: string       // default "GBP"
  pay_type?: PayType
  deliverables?: object
  // ...other listing fields
}
```

**Success 201:** `JobListing`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | User is not a brand |
| 404 | BRAND_PROFILE_NOT_FOUND | Brand has no profile yet |

---

## GET /api/discovery/listings/[listingId]

**Auth:** Session cookie required  
**Description:** Returns a single listing. RLS enforces visibility (active = public; draft = brand owner only).

**Success 200:** `JobListing`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | LISTING_NOT_FOUND | Listing does not exist or is not visible to this user |

---

## PATCH /api/discovery/listings/[listingId]

**Auth:** Session cookie required — brand role only  
**Description:** Updates listing fields. Protected fields are stripped. Brand must own the listing.

**Request body:** Any subset of listing fields (protected fields silently ignored).

**Success 200:** `JobListing`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | User is not a brand |
| 404 | BRAND_PROFILE_NOT_FOUND | Brand has no profile yet |
| 404 | LISTING_NOT_FOUND | Listing not found or not owned by this brand |

---

## POST /api/discovery/listings/[listingId]/publish

**Auth:** Session cookie required — brand role only  
**Description:** Transitions a listing from `draft` to `active`. Only draft listings can be published — calling this on an active, paused, expired, or filled listing returns 404.

**Success 200:**
```ts
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | User is not a brand |
| 404 | BRAND_PROFILE_NOT_FOUND | Brand has no profile yet |
| 404 | LISTING_NOT_FOUND | Listing not found, not owned by this brand, or not in draft status |

---

## POST /api/discovery/connections

**Auth:** Session cookie required  
**Description:** Sends a connection request. Message is required and capped at 300 characters. Duplicate pending requests between the same pair are blocked by a DB partial unique index.

**Request body:**
```ts
{
  recipient_id: string   // users.id
  message: string        // max 300 chars
}
```

**Success 201:** `ConnectionRequest`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | recipient_id or message not provided |
| 400 | MESSAGE_TOO_LONG | Message exceeds 300 characters |
| 401 | UNAUTHENTICATED | No valid session |
| 409 | DUPLICATE_REQUEST | A pending request between these users already exists |

---

## PATCH /api/discovery/connections/[requestId]

**Auth:** Session cookie required  
**Description:** Perform an action on a connection request.

- `accept` / `decline` — recipient only (enforced by DB filter on `recipient_id`)
- `withdraw` — sender only; only works on `pending` requests (enforced by DB filter on `status = 'pending'`)

**Request body:**
```ts
{ "action": "accept" | "decline" | "withdraw" }
```

**Success 200:**
```ts
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_ACTION | action field not provided |
| 400 | INVALID_ACTION | action not one of accept / decline / withdraw |
| 401 | UNAUTHENTICATED | No valid session |
| 404 | REQUEST_NOT_FOUND | Request not found, not accessible to this user, or not in a valid state for this action |

---

## GET /api/discovery/shortlist

**Auth:** Session cookie required  
**Description:** Returns the authenticated user's shortlist entries.

**Success 200:** `Shortlist[]`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/discovery/shortlist

**Auth:** Session cookie required  
**Description:** Adds a user to the authenticated user's shortlist.

**Request body:**
```ts
{ "target_user_id": string }
```

**Success 201:** `Shortlist`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | target_user_id not provided |
| 401 | UNAUTHENTICATED | No valid session |
| 409 | ALREADY_SHORTLISTED | User is already on your shortlist |

---

## DELETE /api/discovery/shortlist/[targetUserId]

**Auth:** Session cookie required  
**Description:** Removes a user from the shortlist. **Idempotent** — returns 200 even if the entry does not exist.

**Success 200:**
```ts
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## GET /api/discovery/blocks

**Auth:** Session cookie required  
**Description:** Returns the authenticated user's block list. Blocked users cannot see that they are blocked (RLS enforced).

**Success 200:** `Block[]`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/discovery/blocks

**Auth:** Session cookie required  
**Description:** Blocks a user.

**Request body:**
```ts
{ "blocked_id": string }
```

**Success 201:** `Block`

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | blocked_id not provided |
| 401 | UNAUTHENTICATED | No valid session |
| 409 | ALREADY_BLOCKED | User is already blocked |

---

## DELETE /api/discovery/blocks/[blockedId]

**Auth:** Session cookie required  
**Description:** Unblocks a user. **Idempotent** — returns 200 even if the block does not exist.

**Success 200:**
```ts
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
