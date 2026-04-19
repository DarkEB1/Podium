# Architecture — Podium

## Layer Diagram
```
Browser
  └── Next.js App Router (app/)
        ├── Server Components → lib/supabase/ → Supabase (Postgres)
        ├── Client Components → Supabase Realtime (websocket)
        ├── Route Handlers (app/api/)
        │     ├── /webhooks/stripe   → lib/stripe/ → Stripe API
        │     ├── /webhooks/esign    → e-signature provider API
        │     ├── /cron/*            → background cleanup jobs
        │     └── /upload            → Supabase Storage presigned URLs
        └── middleware.ts → Supabase Auth session validation
```

## Route Groups
| Group | Purpose | Auth |
|---|---|---|
| `(public)` | Landing, auth pages | None |
| `(athlete)` | Athlete dashboard, profile, discovery | Required — role: athlete |
| `(team)` | Team dashboard, profile, discovery | Required — role: team |
| `(brand)` | Brand dashboard, listings, search | Required — role: brand + active subscription |
| `(agent)` | Agent dashboard, client management | Required — role: agent |
| `(admin)` | Admin panel | Required — admin role + 2FA |

## Data Flow: Profile Fetch
1. Server Component calls `createClient()` from `lib/supabase/server.ts`
2. Query in `lib/supabase/profiles.ts`
3. Result typed via `types/database.ts` (generated)
4. Passed as props to Client Components — no client-side fetch for initial data

## Data Flow: File Upload (large media)
1. Client requests presigned URL from `app/api/upload/route.ts`
2. Server generates URL via Supabase Storage client (service role)
3. Client uploads directly to Supabase Storage — never through Next.js
4. Client sends the storage path to the DB mutation endpoint

## Background Jobs (Vercel Cron)
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/gdpr-purge` | Daily 02:00 UTC | Delete accounts past 14-day grace period |
| `/api/cron/chat-clear` | Daily 03:00 UTC | Auto-clear chats per user retention setting |
| `/api/cron/guardian-expiry` | Daily 04:00 UTC | Purge partial under-18 profiles after 30 days |
| `/api/cron/subscription-grace` | Every 4h | Pause brand accounts after 72hr payment failure |
| `/api/cron/u18-birthday` | Daily 01:00 UTC | Transfer full control on athlete's 18th birthday |

## Required Environment Variables
See `.env.local.example` for full list.
Critical: `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to client.
