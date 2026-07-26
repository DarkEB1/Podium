import { z } from 'zod'

/**
 * Centralised, validated environment configuration.
 *
 * Design constraints (ST-2 / DH-3 / ST-7 / SEC-5):
 * - FAIL FAST with one aggregated error listing every missing/invalid variable,
 *   instead of letting `process.env.X ?? ''` turn a misconfiguration into a
 *   confusing downstream Stripe/Supabase runtime error.
 * - NEVER throw at module-import time. Importing this file must be free of
 *   side effects so it cannot break the Vitest suite or a client bundle.
 *   Validation happens lazily, on first call to `serverEnv()` / `clientEnv()`,
 *   and the result is memoised.
 * - Server-only secrets live in `serverEnv()`. `clientEnv()` reads NEXT_PUBLIC_*
 *   variables only and never touches a server secret, so it is safe to call
 *   from code that ends up in the browser bundle.
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[]
  ) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

/** Where to obtain each variable — surfaced in the aggregated error message. */
const HINTS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase Dashboard → Project Settings → API → Project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase Dashboard → Project Settings → API → anon/public key',
  SUPABASE_SERVICE_ROLE_KEY:
    'Supabase Dashboard → Project Settings → API → service_role key (server only, never expose)',
  NEXT_PUBLIC_APP_URL: 'Public origin of this deployment, e.g. http://localhost:3000',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'Stripe Dashboard → Developers → API keys → Publishable key',
  STRIPE_SECRET_KEY: 'Stripe Dashboard → Developers → API keys → Secret key (sk_… or rk_…)',
  STRIPE_WEBHOOK_SECRET:
    'Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret, or `stripe listen` output (whsec_…)',
  STRIPE_PRICE_TIER_1: 'Stripe Dashboard → Product catalogue → Starter plan → Price ID (price_…)',
  STRIPE_PRICE_TIER_2: 'Stripe Dashboard → Product catalogue → Growth plan → Price ID (price_…)',
  STRIPE_PRICE_TIER_3: 'Stripe Dashboard → Product catalogue → Enterprise plan → Price ID (price_…)',
  CRON_SECRET:
    'Any high-entropy string — `openssl rand -hex 32` — set as a Vercel project env var so Vercel Cron sends it as `Authorization: Bearer …`',
  SENTRY_DSN: 'Sentry → Project Settings → Client Keys (DSN). Optional; omit to log to stdout only',
}

function formatIssues(error: z.ZodError, scope: string): never {
  const issues = error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)'
    const hint = HINTS[name]
    return `  - ${name}: ${issue.message}${hint ? ` — obtain from: ${hint}` : ''}`
  })

  throw new EnvValidationError(
    `Invalid ${scope} environment configuration (${issues.length} problem${
      issues.length === 1 ? '' : 's'
    }):\n${issues.join('\n')}\n\nSee .env.local.example for the full list of required variables.`,
    issues
  )
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const nonEmpty = (label: string) => z.string({ required_error: `${label} is required` }).min(1, `${label} is required`)

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty('NEXT_PUBLIC_SUPABASE_URL').url(
    'must be a valid URL, e.g. https://xxxx.supabase.co'
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  // Public origin used to build Stripe success/cancel URLs and auth redirects.
  NEXT_PUBLIC_APP_URL: nonEmpty('NEXT_PUBLIC_APP_URL').url('must be a valid absolute URL'),
  // Only needed once Stripe Elements/Checkout runs client-side; optional today.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty('SUPABASE_SERVICE_ROLE_KEY'),
  STRIPE_SECRET_KEY: nonEmpty('STRIPE_SECRET_KEY').refine(
    (v) => v.startsWith('sk_') || v.startsWith('rk_'),
    'must be a Stripe secret key starting with "sk_" (or a restricted key starting with "rk_")'
  ),
  STRIPE_WEBHOOK_SECRET: nonEmpty('STRIPE_WEBHOOK_SECRET').refine(
    (v) => v.startsWith('whsec_'),
    'must be a Stripe webhook signing secret starting with "whsec_"'
  ),
  STRIPE_PRICE_TIER_1: nonEmpty('STRIPE_PRICE_TIER_1'),
  STRIPE_PRICE_TIER_2: nonEmpty('STRIPE_PRICE_TIER_2'),
  STRIPE_PRICE_TIER_3: nonEmpty('STRIPE_PRICE_TIER_3'),
  /**
   * ST-2 / SEC-5 — shared bearer secret for `/api/cron/*`.
   *
   * VALIDATED-WHEN-PRESENT, deliberately NOT required. `serverEnv()` is a single
   * aggregated gate shared by Stripe checkout, the webhook and the admin client;
   * making CRON_SECRET mandatory would take the whole payments surface down at
   * boot over a scheduled-job credential, which is a strictly worse failure than
   * the one it prevents. `lib/cron/auth.ts` reads `process.env.CRON_SECRET`
   * directly and FAILS CLOSED (unset ⇒ every cron request is 401), so the
   * security property does not depend on this schema.
   *
   * What this line buys is the OTHER failure mode: a secret that is set but
   * unusable — a truncated paste, a stray quote, a placeholder left from
   * .env.local.example. Those authenticate nothing and, before monitoring, would
   * have shown up only as a GDPR erasure job silently 401-ing forever (DI-4/CL-3).
   * The cron routes additionally emit a `captureMessage` when it is unset, so
   * "never configured" is now observable rather than silent.
   */
  CRON_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters — generate with `openssl rand -hex 32`')
    .optional(),
  /**
   * DH-6 — optional Sentry DSN. When absent (the default) `lib/observability`
   * logs structured JSON to stdout only and imports nothing.
   */
  SENTRY_DSN: z.string().url('must be a valid Sentry DSN URL').optional(),
  /**
   * Transactional email (lib/email). All VALIDATED-WHEN-PRESENT, for the same
   * reason as CRON_SECRET: making them mandatory would take the payments and
   * auth surfaces down at boot over the email subsystem, a worse failure than
   * the one it prevents. When RESEND_API_KEY is unset the provider is a no-op
   * that records `skipped` — the app runs, nothing is delivered, and local dev
   * and CI need no mail account.
   */
  RESEND_API_KEY: z
    .string()
    .refine((v) => v.startsWith('re_'), 'must be a Resend API key starting with "re_"')
    .optional(),
  /** Envelope From, e.g. "Podium <notifications@mail.podium.app>". */
  EMAIL_FROM: z.string().optional(),
  /** Optional Reply-To for transactional mail. */
  EMAIL_REPLY_TO: z.string().email('must be a valid email address').optional(),
  /**
   * HMAC key for one-click unsubscribe tokens (CL-4). When unset, marketing
   * emails ship a preferences link instead of a one-click unsubscribe, and the
   * unsubscribe route rejects every token — see lib/email/unsubscribe.ts.
   */
  UNSUBSCRIBE_SECRET: z
    .string()
    .min(16, 'must be at least 16 characters — generate with `openssl rand -hex 32`')
    .optional(),
})

export type ClientEnv = z.infer<typeof clientSchema>
export type ServerEnv = z.infer<typeof serverSchema>

// ---------------------------------------------------------------------------
// Lazy, memoised accessors
// ---------------------------------------------------------------------------

let _client: ClientEnv | undefined
let _server: ServerEnv | undefined

/**
 * Validated NEXT_PUBLIC_* configuration. Safe to call from client bundles —
 * every reference below is a literal `process.env.NEXT_PUBLIC_*` so Next.js
 * can statically inline it. Never reads a server secret.
 */
export function clientEnv(): ClientEnv {
  if (_client) return _client

  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // NEXT_PUBLIC_SITE_URL is accepted as an alias so either naming works.
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  })

  if (!parsed.success) formatIssues(parsed.error, 'client')

  _client = parsed.data
  return _client
}

/**
 * Validated server-only configuration. Throws `EnvValidationError` listing
 * every problem at once. Must never be imported into a `"use client"` module.
 */
export function serverEnv(): ServerEnv {
  if (_server) return _server

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_TIER_1: process.env.STRIPE_PRICE_TIER_1,
    STRIPE_PRICE_TIER_2: process.env.STRIPE_PRICE_TIER_2,
    STRIPE_PRICE_TIER_3: process.env.STRIPE_PRICE_TIER_3,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    SENTRY_DSN: process.env.SENTRY_DSN || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || undefined,
    UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET || undefined,
  })

  if (!parsed.success) formatIssues(parsed.error, 'server')

  _server = parsed.data
  return _server
}

/**
 * Clears the memoised values. Tests mutate `process.env` between cases and need
 * the next accessor call to re-read it; nothing in application code calls this.
 */
export function resetEnvCache(): void {
  _client = undefined
  _server = undefined
}
