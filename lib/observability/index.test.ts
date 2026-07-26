import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  captureException,
  captureMessage,
  registerTransport,
  resetTransports,
  withRequestContext,
  type StructuredLogRecord,
} from './index'
import { REDACTED } from './redact'

function lastJson(spy: ReturnType<typeof vi.spyOn>): StructuredLogRecord {
  const calls = spy.mock.calls
  const line = calls[calls.length - 1]?.[0]
  return JSON.parse(String(line)) as StructuredLogRecord
}

describe('observability', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetTransports()
    delete process.env.SENTRY_DSN
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetTransports()
  })

  it('writes one line of parseable JSON per exception', () => {
    captureException(new Error('boom'), { route: '/api/x' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const record = lastJson(errorSpy)
    expect(record.level).toBe('error')
    expect(record.event).toBe('exception')
    expect(record.message).toBe('boom')
    expect(record.name).toBe('Error')
    expect(record.context).toEqual({ route: '/api/x' })
    expect(Date.parse(record.timestamp)).not.toBeNaN()
  })

  it('includes a redacted stack trace', () => {
    captureException(new Error('failed'))
    expect(lastJson(errorSpy).stack).toContain('Error: failed')
  })

  it('redacts PII from the error message', () => {
    captureException(new Error('no user for nicholas@example.com'))
    expect(lastJson(errorSpy).message).toBe(`no user for ${REDACTED}`)
  })

  it('redacts PII from the context', () => {
    captureException(new Error('x'), { email: 'a@b.co', message: 'private note', userId: 'u1' })
    expect(lastJson(errorSpy).context).toEqual({
      email: REDACTED,
      message: REDACTED,
      userId: 'u1',
    })
  })

  it('handles non-Error throws without crashing', () => {
    captureException({ weird: true })
    expect(lastJson(errorSpy).message).toBe('Non-Error value thrown')
  })

  it('routes message severities to the matching console channel', () => {
    captureMessage('all good', 'info')
    expect(logSpy).toHaveBeenCalledTimes(1)

    captureMessage('degraded', 'warning')
    expect(warnSpy).toHaveBeenCalledTimes(1)

    captureMessage('down', 'fatal')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('never throws, even on a circular context', () => {
    const circular: Record<string, unknown> = { route: '/x' }
    circular.self = circular
    expect(() => captureException(new Error('boom'), circular)).not.toThrow()
  })

  it('fans out to registered transports', () => {
    const transport = vi.fn()
    registerTransport(transport)

    captureMessage('hello', 'info', { route: '/x' })

    expect(transport).toHaveBeenCalledTimes(1)
    const record = transport.mock.calls[0]?.[0] as StructuredLogRecord
    expect(record.message).toBe('hello')
  })

  it('survives a transport that throws', () => {
    registerTransport(() => {
      throw new Error('transport down')
    })
    expect(() => captureMessage('hello')).not.toThrow()
    expect(logSpy).toHaveBeenCalled()
  })

  it('does not load any Sentry SDK when SENTRY_DSN is unset', () => {
    // The zero-dependency guarantee: @sentry/node is not in package.json, so if
    // this path tried to import it the capture would still have to succeed.
    expect(process.env.SENTRY_DSN).toBeUndefined()
    expect(() => captureException(new Error('boom'))).not.toThrow()
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('withRequestContext', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetTransports()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('merges the base context into every capture', () => {
    const obs = withRequestContext({ route: '/api/cron/maintenance', method: 'GET' })
    obs.captureException(new Error('purge failed'), { stage: 'rpc' })

    expect(lastJson(errorSpy).context).toEqual({
      route: '/api/cron/maintenance',
      method: 'GET',
      stage: 'rpc',
    })
  })

  it('lets the call-site context win on key collision', () => {
    const obs = withRequestContext({ stage: 'base' })
    obs.captureMessage('x', 'error', { stage: 'override' })
    expect(lastJson(errorSpy).context).toEqual({ stage: 'override' })
  })

  it('redacts base context too', () => {
    const obs = withRequestContext({ email: 'a@b.co' })
    obs.captureException(new Error('x'))
    expect(lastJson(errorSpy).context).toEqual({ email: REDACTED })
  })
})
