# Prompt — feed this to your Claude Code agent

Paste the block below into a Claude Code session opened in the Podium repo (on `main`).

---

You are completing the backend-dependent features of Podium (Next.js 15 App Router · TypeScript strict · Supabase · Stripe · Tailwind 4 · shadcn/ui · Vitest · Playwright). I have **live Supabase and Stripe access** and can add env vars, run migrations, create Storage buckets, and configure Stripe.

**Read `docs/handoff/backend-completion-guide.md` in full before doing anything** — it is the authoritative spec. It lists what is already WIRED (do not rebuild) and the eight features that are scaffolded/stubbed and need finishing, each with exact files, schema, steps, and acceptance criteria.

Also read and obey `CLAUDE.md` (architecture rules) — in particular: no Supabase calls outside `lib/supabase`/`lib/storage`/`lib/realtime`/`lib/notifications`; no Stripe outside `lib/stripe`; every new table gets an RLS policy in the same migration; schema change → migration file → `supabase db push` → regenerate `types/database.ts` → then code; webhooks verify HMAC first; uploads use presigned URLs only; TypeScript strict (no `any`).

**Process — work one feature at a time, in the build order in §11 of the guide:**
1. Start with the Setup checklist (§1) — confirm env vars, migrations applied, the four Storage buckets created, Stripe products/webhook, Realtime enabled. Tell me exactly which dashboard/CLI steps you need me to do and pause for me to confirm them before relying on them.
2. For each feature: write the migration first (with RLS), apply it, regenerate types, then add the `lib/` functions, then the API routes, then wire the existing UI, following TDD (co-located Vitest tests first).
3. Before marking a feature done, run `npm run check` (test + type-check + lint) and confirm it is green. Then commit that feature with a clear conventional message. Do not bundle multiple features in one commit.
4. After each feature, give me a short status: what you built, the acceptance check, and anything you need from me (a provider API key, a Stripe setting, etc.).

**Do NOT** touch the already-wired subscription/deal-payment Stripe flows, the storage/realtime helpers, or the design/styling — this is backend wiring only. If anything in the guide conflicts with the actual code, trust the code, tell me, and propose a fix.

Begin by reading the guide and `CLAUDE.md`, then give me the Setup (§1) checklist of what you need me to provision before you start coding.

---
