import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { forwardToSentry, resetSentry } from './sentry'
import type { StructuredLogRecord } from './index'

const RECORD: StructuredLogRecord = {
  level: 'error',
  event: 'exception',
  message: 'boom',
  name: 'Error',
  timestamp: '2026-07-20T00:00:00.000Z',
  context: { route: '/api/x' },
}

describe('forwardToSentry', () => {
  beforeEach(() => {
    resetSentry()
    delete process.env.SENTRY_DSN
  })

  afterEach(() => {
    resetSentry()
    delete process.env.SENTRY_DSN
  })

  it('is a no-op when SENTRY_DSN is unset — the default, zero-dependency path', async () => {
    await expect(forwardToSentry(RECORD)).resolves.toBe(false)
  })

  it('reports failure rather than throwing when the SDK is not installed', async () => {
    // @sentry/node is deliberately absent from package.json. Setting a DSN must
    // degrade to console-only logging, never break the request.
    process.env.SENTRY_DSN = 'https://public@o0.ingest.sentry.io/0'
    await expect(forwardToSentry(RECORD)).resolves.toBe(false)
  })

  it('does not retry the failed import on every capture', async () => {
    process.env.SENTRY_DSN = 'https://public@o0.ingest.sentry.io/0'
    await forwardToSentry(RECORD)
    const started = Date.now()
    await forwardToSentry(RECORD)
    // Second call short-circuits on the cached "unavailable" state.
    expect(Date.now() - started).toBeLessThan(50)
  })
})
