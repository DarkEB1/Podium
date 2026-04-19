# Lessons Learned

- **This project uses shadcn v4 `base-nova` style with `@base-ui/react` primitives — NOT `@radix-ui/react-*`**: When adding new shadcn components, use `npx shadcn@latest add <component>` — do NOT manually import from `@radix-ui/react-*` component primitives (e.g. `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`). `@radix-ui/react-slot` is acceptable — it is used by `button.tsx` and `form.tsx` via the `asChild` pattern. The `base-nova` style uses `@base-ui/react` instead of Radix. `toast` is replaced by `sonner`. Check `components.json` for the source of truth on style configuration.

- **Always verify webhook HMAC before processing any event**: Skipping this means fraudulent Stripe or DocuSign events get processed as real. Use `stripe.webhooks.constructEvent()` — return 400 if it throws.

- **Never expose SUPABASE_SERVICE_ROLE_KEY to client components**: This key bypasses RLS and has full DB access. It belongs only in Server Components, Route Handlers, and Cron jobs — never in any file with `"use client"`.

- **All under-18 athlete flows require a guardian check before any deal action**: Missing this is a legal liability. Check `athlete_profiles.guardian_id` is set and `guardian_profiles.consent_given = true` before allowing proposal acceptance or contract signing.

- **RLS policy must exist before any code queries a new table**: A table without RLS exposes all rows to all authenticated users. Write the policy in the same migration file as the table creation — not as a follow-up.

- **Presigned URLs expire — generate at request time, never cache**: Supabase Storage presigned URLs have a short TTL. Always generate fresh in `app/api/upload/route.ts` per request. Never store a presigned URL in the DB or localStorage.
