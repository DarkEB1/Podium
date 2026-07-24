/**
 * Optional Sentry forwarding (DH-6).
 *
 * `@sentry/node` is NOT a dependency of this project and must not become one
 * just to keep an interface open: it is a large package, and the console-JSON
 * path in `./index.ts` already gives Vercel-queryable telemetry for free.
 *
 * This module therefore does nothing at all unless `SENTRY_DSN` is set. When it
 * is, the SDK is imported at RUNTIME through an indirect specifier so no
 * bundler ever tries to resolve it at build time — if the package is not
 * installed, the import fails once, is remembered as unavailable, and the
 * console path continues unaffected.
 */

import type { StructuredLogRecord } from './index'

interface SentryLike {
  init?: (options: { dsn: string; tracesSampleRate?: number }) => void
  captureException?: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void
  captureMessage?: (message: string, hint?: { level?: string; extra?: Record<string, unknown> }) => void
}

type LoadState = 'unattempted' | 'loading' | 'ready' | 'unavailable'

let state: LoadState = 'unattempted'
let sentry: SentryLike | null = null

/** The package to load. Overridable so tests can point at a stub. */
const SENTRY_MODULE = process.env.SENTRY_MODULE ?? '@sentry/node'

/**
 * Indirect dynamic import. A bare `await import(specifier)` with a non-literal
 * still leaves a webpack "critical dependency" warning and can be traced by the
 * Next.js bundler; building the import through `Function` keeps the optional
 * dependency genuinely optional. Only ever reached when SENTRY_DSN is set.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>

/** Test seam — forget any previously loaded SDK. */
export function resetSentry(): void {
  state = 'unattempted'
  sentry = null
}

async function loadSentry(dsn: string): Promise<SentryLike | null> {
  if (state === 'ready') return sentry
  if (state === 'unavailable' || state === 'loading') return null

  state = 'loading'
  try {
    // as SentryLike: the module is resolved at runtime so TypeScript has no
    // declaration for it; every member is called optionally below.
    const mod = (await dynamicImport(SENTRY_MODULE)) as SentryLike
    mod.init?.({ dsn })
    sentry = mod
    state = 'ready'
    return sentry
  } catch {
    // Not installed, or failed to initialise. Console logging remains the
    // source of truth; never retry on every request.
    state = 'unavailable'
    return null
  }
}

/**
 * Forwards an already-redacted record to Sentry when configured. Resolves to
 * `true` when the record was handed to the SDK.
 */
export async function forwardToSentry(record: StructuredLogRecord): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return false

  const client = await loadSentry(dsn)
  if (!client) return false

  try {
    if (record.event === 'exception') {
      const error = new Error(record.message)
      error.name = record.name ?? 'Error'
      if (record.stack) error.stack = record.stack
      client.captureException?.(error, { extra: record.context })
    } else {
      client.captureMessage?.(record.message, { level: record.level, extra: record.context })
    }
    return true
  } catch {
    return false
  }
}
