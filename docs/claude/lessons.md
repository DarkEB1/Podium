# Lessons Learned

- **This project uses shadcn v4 `base-nova` style with `@base-ui/react` primitives — NOT `@radix-ui/react-*`**: When adding new shadcn components, use `npx shadcn@latest add <component>` — do NOT manually import from `@radix-ui/react-*` component primitives (e.g. `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`). `@radix-ui/react-slot` is acceptable — it is used by `button.tsx` and `form.tsx` via the `asChild` pattern. The `base-nova` style uses `@base-ui/react` instead of Radix. `toast` is replaced by `sonner`. Check `components.json` for the source of truth on style configuration.

- **Always verify webhook HMAC before processing any event**: Skipping this means fraudulent Stripe or DocuSign events get processed as real. Use `stripe.webhooks.constructEvent()` — return 400 if it throws.

- **Never expose SUPABASE_SERVICE_ROLE_KEY to client components**: This key bypasses RLS and has full DB access. It belongs only in Server Components, Route Handlers, and Cron jobs — never in any file with `"use client"`.

- **All under-18 athlete flows require a guardian check before any deal action**: Missing this is a legal liability. Check `athlete_profiles.guardian_id` is set and `guardian_profiles.consent_given = true` before allowing proposal acceptance or contract signing.

- **RLS policy must exist before any code queries a new table**: A table without RLS exposes all rows to all authenticated users. Write the policy in the same migration file as the table creation — not as a follow-up.

- **Presigned URLs expire — generate at request time, never cache**: Supabase Storage presigned URLs have a short TTL. Always generate fresh in `app/api/upload/route.ts` per request. Never store a presigned URL in the DB or localStorage.

- **One DB column, one UI owner — a second surface writing the same enum column will drift**: Onboarding step 3 kept a legacy "I am seeking" chip set whose five values predated the `seeking_type` NIL migration; every chip was an invalid enum value, so any selection failed the whole PATCH with the generic "could not save" message. When a migration redefines an enum, grep every component that writes that column, not just the one the spec section names.

- **base-ui `Select.Value` renders the raw value string — always pass `items` to `Select` (the root)**: Unlike Radix, the collapsed trigger does not mirror the selected item's label. Without `items={OPTIONS}` users see raw enum values like `available_now`.

- **Never put `capture` on a file input that is also the library picker**: `capture` forces mobile browsers straight to the camera and makes the photo roll unreachable. Camera and library need two separate inputs.

- **Email addresses in code must use podiumsponsorship.com — podium.com belongs to a third party**: Any `@podium.com` address routes user mail (including privacy/legal requests) to a domain we do not control. `CONTROLLER` in `lib/legal/versions.ts` is the single source of truth.

- **Hosted Supabase auth config is code now**: `supabase/config.toml` has `[remotes.staging]` overrides; `npx supabase config push` applies base+override to the LINKED project, so any base value not overridden will overwrite what was set in the dashboard. Check the printed diff line by line before confirming, and add overrides for values the hosted project must keep.

- **Two money units live in this codebase; never render or send an amount without checking which**: `proposals.pay_amount` and `job_listings.pay_amount` are MAJOR units (what a human typed); `payments.amount`, `payments.net_amount`, `stripe_fee` and everything Stripe returns are MINOR. Passing the major figure to Stripe charged 1/100th of every deal, and printing a minor column raw inflated the admin revenue dashboard 100x. Convert with `toMinorUnits` (lib/stripe), display with `formatMinorAmount` / `formatMajorAmount` (lib/money).

- **RLS that constrains WHEN a column may change must also constrain WHAT it may become**: `users_update_own` froze `role` after the lock but placed no condition on the value while unlocked, and every account starts unlocked, so `user_role`'s `admin` member was self-assignable through PostgREST with the public anon key. When an enum contains a privileged value, the policy needs an explicit clause about that value, not just a lifecycle rule.

- **Anything the UI renders as authoritative must be server-written**: the messages API accepted `payment_confirmation` from either chat participant, and the chat renders it as a real payment receipt. If no server code creates a content type, clients must not be able to either. The same goes for its `metadata`.

- **A route handler that re-throws a domain error produces a bodyless 500, and the browser's `res.json()` then throws before it can read the failure**: that is why several rejected writes reached users as silence or a generic toast. Map domain errors to a JSON envelope in every handler; `lib/api/errors.ts` holds the shared mapper (route modules cannot export helpers).

- **A migration and the code that needs it are separate deploy steps, so the code must tolerate the column not being there yet**: naming an unknown column makes PostgREST reject the ENTIRE PATCH, so an unconditional `industry_other` would have failed brand onboarding for every brand instead of only the ones the field is for. Send such a key only when it carries a value.

- **`sanitizeProfileData` and `sanitizeListingData` drop empty strings, not nulls**: `''` therefore cannot clear a column (the write is silently skipped) and `null` is the only way to blank one. A `''` reaching a non-text column (timestamptz, enum) fails the whole statement, which is why blank optional fields must be omitted or nulled at the form.

- **A path-prefix gate written for pages does not cover the API twin**: `ADMIN_PATHS = ['/admin']` never matched `/api/admin/...`, so the admin 2FA challenge applied to the browser surface only while every admin mutation stayed reachable by direct API call. When adding a route gate, list BOTH the page prefix and its `/api/` counterpart, and answer API paths with a JSON error, never a redirect: `fetch` follows a 307 silently and the caller sees HTML.

- **Requiring proof to turn a protection ON but not to turn it OFF is not a protection**: disabling 2FA needed only a live session, which is exactly what an attacker who stole a session already has. Symmetry check: whatever proof enables a security control must also be required to disable it. Changing an endpoint's contract this way also breaks its existing caller, so update the UI in the same change.

- **`await searchParams` makes a page dynamic, so it stops being CDN-cached**: `/auth` and `/auth/signup` rendered per request purely to read `?role=` and `?error=`, while every other public page prerendered. Read the query in a small client component behind `<Suspense>` and the page goes back to static. Verify with the `next build` route table: `○` is static, `ƒ` is per-request.
