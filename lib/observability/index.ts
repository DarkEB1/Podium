/**
 * Observability (DH-6) — provider-agnostic error and event reporting.
 *
 * Phase 2's goal is "so the launch is observable". Before this module the app
 * ran blind: every failure path ended in `console.error(...)` with an
 * unstructured string, or in a bare `catch {}`.
 *
 * Design:
 *  - **Zero dependencies by default.** Every capture writes ONE line of
 *    structured JSON to stdout/stderr. Vercel ingests stdout as log entries and
 *    parses JSON into queryable fields, so this alone gives searchable,
 *    alertable telemetry with no vendor and no cost.
 *  - **Sentry is optional and lazy.** If `SENTRY_DSN` is set, the first capture
 *    attempts to load `@sentry/node` at runtime (see ./sentry.ts). The package
 *    is NOT in package.json; when it is absent or the DSN is unset, nothing is
 *    imported and the bundle is unaffected.
 *  - **PII never leaves the process.** Every payload goes through
 *    `lib/observability/redact.ts` first: no email addresses, tokens, message
 *    bodies or free-text content, ever.
 *  - **Capture never throws.** Reporting a failure must not create one.
 *
 * Enabling Sentry:
 *   1. `npm install @sentry/node`
 *   2. set `SENTRY_DSN` in the deployment environment
 * No code change is required.
 */

import { redactContext, redactString } from './redact'
import { forwardToSentry } from './sentry'

export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

/** Structured, non-PII metadata attached to a capture. */
export type ObservabilityContext = Record<string, unknown>

/** The shape written to stdout. Stable — log queries depend on these keys. */
export interface StructuredLogRecord {
  level: Severity
  event: 'exception' | 'message'
  message: string
  name?: string | undefined
  stack?: string | undefined
  timestamp: string
  context: ObservabilityContext
}

/**
 * An additional sink. Registered by the host (e.g. `instrumentation.ts`) when a
 * provider other than Sentry is wanted. Kept so adding a vendor never requires
 * editing this file.
 */
export type Transport = (record: StructuredLogRecord) => void

const transports: Transport[] = []

export function registerTransport(transport: Transport): void {
  transports.push(transport)
}

/** Test helper — drops every registered transport. */
export function resetTransports(): void {
  transports.length = 0
}

function nowIso(): string {
  return new Date().toISOString()
}

function normaliseError(error: unknown): {
  message: string
  name?: string | undefined
  stack?: string | undefined
} {
  if (error instanceof Error) {
    return {
      message: redactString(error.message),
      name: error.name,
      // Stack frames are file paths, not user data, but interpolated values can
      // appear in them — redact anyway.
      stack: error.stack ? redactString(error.stack) : undefined,
    }
  }
  if (typeof error === 'string') return { message: redactString(error) }
  return { message: 'Non-Error value thrown', name: typeof error }
}

function emit(record: StructuredLogRecord): void {
  try {
    const line = JSON.stringify(record)
    if (record.level === 'error' || record.level === 'fatal') {
      console.error(line)
    } else if (record.level === 'warning') {
      console.warn(line)
    } else {
      console.log(line)
    }

    for (const transport of transports) {
      try {
        transport(record)
      } catch {
        // A broken transport must not break the request.
      }
    }

    void forwardToSentry(record)
  } catch {
    // Serialisation failure (circular structure that survived redaction, etc.).
    // Nothing further we can safely do.
  }
}

/**
 * Report an error. Use everywhere a `catch` currently swallows or
 * `console.error`s. Returns void and never throws.
 */
export function captureException(
  error: unknown,
  context?: ObservabilityContext,
  level: Severity = 'error'
): void {
  const { message, name, stack } = normaliseError(error)
  emit({
    level,
    event: 'exception',
    message,
    name,
    stack,
    timestamp: nowIso(),
    context: redactContext(context),
  })
}

/** Report a noteworthy non-exception condition (misconfiguration, degradation). */
export function captureMessage(
  message: string,
  level: Severity = 'info',
  context?: ObservabilityContext
): void {
  emit({
    level,
    event: 'message',
    message: redactString(message),
    timestamp: nowIso(),
    context: redactContext(context),
  })
}

/** The same capture surface, with a fixed context merged into every call. */
export interface ScopedObservability {
  captureException: (error: unknown, context?: ObservabilityContext, level?: Severity) => void
  captureMessage: (message: string, level?: Severity, context?: ObservabilityContext) => void
}

/**
 * Binds request-scoped metadata (route, method, request id, user role — never
 * the user's email) to every capture made through the returned object.
 *
 * Deliberately NOT `AsyncLocalStorage`: that is Node-only and would break the
 * Edge middleware and client bundles that also need to report errors. Passing
 * the scope explicitly works in every runtime.
 *
 *   const obs = withRequestContext({ route: '/api/cron/maintenance' })
 *   obs.captureException(err, { stage: 'purge' })
 */
export function withRequestContext(base: ObservabilityContext): ScopedObservability {
  return {
    captureException: (error, context, level) =>
      captureException(error, { ...base, ...context }, level),
    captureMessage: (message, level, context) =>
      captureMessage(message, level, { ...base, ...context }),
  }
}
