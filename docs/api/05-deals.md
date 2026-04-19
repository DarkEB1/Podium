# 05 — Deals API

## Surface Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/deals/proposals` | required | Send a proposal in a match (brand only via RLS) |
| `GET` | `/api/deals/proposals?matchId=` | required | List proposals for a match |
| `POST` | `/api/deals/proposals/[proposalId]/respond` | required | Accept or decline a proposal (recipient only) |
| `POST` | `/api/deals/proposals/[proposalId]/counter` | required | Submit a counter-proposal (recipient only) |
| `DELETE` | `/api/deals/proposals/[proposalId]` | required | Withdraw a pending proposal (sender only) |
| `GET` | `/api/deals/proposals/[proposalId]/contract` | required | Get contract for an accepted proposal |

---

## POST /api/deals/proposals

**Auth:** Session cookie required  
**Description:** Creates a new proposal in a match. RLS enforces that only a brand participant of the match can insert. `deliverables` defaults to `{}` if omitted.

**Request body:**
```json
{
  "match_id": "uuid",
  "title": "string",
  "deliverables": {},
  "pay_amount": 5000,
  "pay_currency": "GBP",
  "pay_type": "flat_fee | monthly_retainer | per_post | revenue_share",
  "timeline_start": "2026-06-01 (optional)",
  "timeline_end": "2026-08-31 (optional)",
  "usage_rights": {} ,
  "additional_terms": "string (optional)"
}
```

**Success 201:**
```json
{
  "id": "uuid",
  "match_id": "uuid",
  "sender_id": "uuid",
  "parent_proposal_id": null,
  "status": "pending",
  "title": "Summer Campaign",
  "deliverables": {},
  "pay_amount": 5000,
  "pay_currency": "GBP",
  "pay_type": "flat_fee",
  "timeline_start": "2026-06-01",
  "timeline_end": "2026-08-31",
  "usage_rights": null,
  "additional_terms": null,
  "responded_at": null,
  "created_at": "2026-04-19T00:00:00Z",
  "updated_at": "2026-04-19T00:00:00Z"
}
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 400 | MISSING_FIELDS | `match_id`, `title`, `pay_amount`, or `pay_type` not provided |
| 400 | INVALID_PAY_TYPE | `pay_type` not a valid enum value |
| 401 | UNAUTHENTICATED | No valid session |
| 422 | PROPOSAL_INSERT_FAILED | DB constraint violation (e.g. RLS rejection) |

---

## GET /api/deals/proposals?matchId=

**Auth:** Session cookie required  
**Description:** Returns all proposals for a match, ordered by `created_at` ascending. Caller must be a match participant (enforced by RLS on matches and proposals).

**Success 200:**
```json
[
  {
    "id": "uuid",
    "match_id": "uuid",
    "sender_id": "uuid",
    "parent_proposal_id": "uuid | null",
    "status": "pending | accepted | declined | countered | withdrawn",
    "title": "string",
    "deliverables": {},
    "pay_amount": 5000,
    "pay_currency": "GBP",
    "pay_type": "flat_fee",
    "timeline_start": "2026-06-01",
    "timeline_end": "2026-08-31",
    "usage_rights": null,
    "additional_terms": null,
    "responded_at": null,
    "created_at": "2026-04-19T00:00:00Z",
    "updated_at": "2026-04-19T00:00:00Z"
  }
]
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 400 | MISSING_FIELDS | `matchId` query parameter not provided |
| 401 | UNAUTHENTICATED | No valid session |
| 404 | MATCH_NOT_FOUND | Match does not exist or caller is not a participant |

---

## POST /api/deals/proposals/[proposalId]/respond

**Auth:** Session cookie required  
**Description:** Accepts or declines a pending proposal. Only the non-sender (recipient) can respond. On acceptance, a `contract` row is created automatically (service role bypass). Sets `responded_at` timestamp.

**Request body:**
```json
{
  "action": "accepted | declined"
}
```

**Success 200:**
```json
{
  "id": "uuid",
  "status": "accepted | declined",
  "responded_at": "2026-04-19T01:00:00Z"
}
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 400 | MISSING_ACTION | `action` not provided |
| 400 | INVALID_ACTION | `action` not `accepted` or `declined` |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | NOT_RECIPIENT | Caller is the proposal sender |
| 404 | PROPOSAL_NOT_FOUND | Proposal does not exist or not accessible |
| 409 | PROPOSAL_NOT_PENDING | Proposal status is not `pending` |

---

## POST /api/deals/proposals/[proposalId]/counter

**Auth:** Session cookie required  
**Description:** Creates a counter-proposal. Only the recipient (non-sender) can counter. Marks the parent proposal as `countered` and inserts a new proposal row with `parent_proposal_id` set.

**Request body:**
```json
{
  "title": "string",
  "deliverables": {},
  "pay_amount": 4000,
  "pay_currency": "GBP",
  "pay_type": "flat_fee | monthly_retainer | per_post | revenue_share",
  "timeline_start": "2026-06-01 (optional)",
  "timeline_end": "2026-09-30 (optional)",
  "usage_rights": {} ,
  "additional_terms": "string (optional)"
}
```

**Success 201:** Returns the new counter-proposal row (same shape as proposal).

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 400 | MISSING_FIELDS | `title`, `pay_amount`, or `pay_type` not provided |
| 400 | INVALID_PAY_TYPE | `pay_type` not a valid enum value |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | NOT_RECIPIENT | Caller is the proposal sender |
| 404 | PROPOSAL_NOT_FOUND | Parent proposal does not exist or not accessible |
| 409 | PROPOSAL_NOT_PENDING | Parent proposal status is not `pending` |

---

## DELETE /api/deals/proposals/[proposalId]

**Auth:** Session cookie required  
**Description:** Withdraws a pending proposal. Only the sender can withdraw, and only while the proposal is `pending`. Sets `status = 'withdrawn'` and records `responded_at`.

**Success 200:**
```json
{ "success": true }
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | PROPOSAL_NOT_FOUND | Proposal not found, not owned by caller, or not pending |

---

## GET /api/deals/proposals/[proposalId]/contract

**Auth:** Session cookie required  
**Description:** Returns the contract created when a proposal was accepted. RLS allows brand, athlete/team, and agent to read. Returns 404 if the proposal has not been accepted yet.

**Success 200:**
```json
{
  "id": "uuid",
  "proposal_id": "uuid",
  "match_id": "uuid",
  "brand_id": "uuid",
  "athlete_or_team_id": "uuid",
  "agent_id": "uuid | null",
  "status": "draft | pending_brand_signature | pending_athlete_signature | fully_signed | terminated",
  "document_url": "string | null",
  "brand_signed_at": "timestamptz | null",
  "athlete_signed_at": "timestamptz | null",
  "locked_at": "timestamptz | null",
  "retain_until": "timestamptz | null",
  "created_at": "2026-04-19T00:00:00Z",
  "updated_at": "2026-04-19T00:00:00Z"
}
```

**Errors:**
| Status | Code | Meaning |
|---|---|---|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | CONTRACT_NOT_FOUND | No contract exists for this proposal |
