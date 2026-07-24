import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}))

import {
  RATE_LIMITS,
  clientIpFrom,
  consume,
  consumeAll,
  emailKey,
  ipKey,
  reset,
  tooManyRequests,
  userKey,
} from './index'

function allow(attempts = 1) {
  return { data: [{ allowed: true, attempts, retry_after: 0 }], error: null }
}
function deny(retryAfter = 42, attempts = 99) {
  return { data: [{ allowed: false, attempts, retry_after: retryAfter }], error: null }
}

describe('rate-limit keys', () => {
  it('namespaces by action and axis so budgets never collide', () => {
    expect(ipKey('login', '1.2.3.4')).toBe('login:ip:1.2.3.4')
    expect(emailKey('login', 'a@b.com')).toBe('login:email:a@b.com')
    expect(userKey('write', 'u1')).toBe('write:user:u1')
    expect(ipKey('login', '1.2.3.4')).not.toBe(ipKey('signup', '1.2.3.4'))
  })

  it('normalises email so case and whitespace share one budget', () => {
    expect(emailKey('login', '  A@B.com ')).toBe(emailKey('login', 'a@b.com'))
  })
})

describe('clientIpFrom', () => {
  it('takes the leftmost x-forwarded-for entry (the original client)', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip, then to a stable placeholder', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(clientIpFrom(new Headers())).toBe('unknown')
  })
})

describe('consume', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('passes the rule through to the atomic SQL counter', async () => {
    mockRpc.mockResolvedValue(allow())
    await consume('login:ip:1.2.3.4', RATE_LIMITS.loginByIp)

    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'login:ip:1.2.3.4',
      p_limit: RATE_LIMITS.loginByIp.limit,
      p_window_seconds: RATE_LIMITS.loginByIp.windowSeconds,
    })
  })

  it('refuses and reports retry-after when the window is exhausted', async () => {
    mockRpc.mockResolvedValue(deny(30))
    const result = await consume('k', RATE_LIMITS.loginByEmail)

    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBe(30)
  })

  // Documented trade-off: a store outage must not become a total auth outage.
  it('fails OPEN and flags degradation when the store is unreachable', async () => {
    mockRpc.mockRejectedValue(new Error('connection refused'))
    const result = await consume('k', RATE_LIMITS.loginByIp)

    expect(result.allowed).toBe(true)
    expect(result.degraded).toBe(true)
  })

  it('fails open when the RPC returns an error rather than throwing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await consume('k', RATE_LIMITS.loginByIp)

    expect(result.allowed).toBe(true)
    expect(result.degraded).toBe(true)
  })
})

describe('consumeAll', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('refuses when ANY axis trips', async () => {
    mockRpc.mockResolvedValueOnce(allow()).mockResolvedValueOnce(deny(60))

    const result = await consumeAll([
      { key: ipKey('login', '1.2.3.4'), rule: RATE_LIMITS.loginByIp },
      { key: emailKey('login', 'a@b.com'), rule: RATE_LIMITS.loginByEmail },
    ])

    expect(result.allowed).toBe(false)
    // must report the LONGEST wait, not the first
    expect(result.retryAfter).toBe(60)
  })

  // Otherwise an attacker could trip the cheap per-IP rule deliberately to
  // avoid ever spending their per-email budget.
  it('consumes every axis even after one has already failed', async () => {
    mockRpc.mockResolvedValueOnce(deny()).mockResolvedValueOnce(allow())

    await consumeAll([
      { key: 'a', rule: RATE_LIMITS.loginByIp },
      { key: 'b', rule: RATE_LIMITS.loginByEmail },
    ])

    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('allows when every axis is under its limit', async () => {
    mockRpc.mockResolvedValue(allow())
    const result = await consumeAll([
      { key: 'a', rule: RATE_LIMITS.loginByIp },
      { key: 'b', rule: RATE_LIMITS.loginByEmail },
    ])
    expect(result.allowed).toBe(true)
  })
})

describe('reset', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('clears the key so a successful sign-in discards earlier typos', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await reset('login:ip:1.2.3.4')
    expect(mockRpc).toHaveBeenCalledWith('reset_rate_limit', { p_key: 'login:ip:1.2.3.4' })
  })

  it('never throws — the window expires on its own', async () => {
    mockRpc.mockRejectedValue(new Error('down'))
    await expect(reset('k')).resolves.toBeUndefined()
  })
})

describe('tooManyRequests', () => {
  it('returns 429 with a truthful Retry-After and the standard error shape', async () => {
    const res = tooManyRequests(30)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(await res.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: expect.stringContaining('Too many attempts') },
    })
  })

  it('never advertises a zero-second retry', () => {
    expect(tooManyRequests(0).headers.get('Retry-After')).toBe('1')
  })

  // Telling an attacker which axis tripped, or how many attempts remain, is
  // reconnaissance.
  it('does not disclose which axis tripped or how many attempts remain', async () => {
    const body = JSON.stringify(await tooManyRequests(30).json())
    // no axis names...
    expect(body).not.toMatch(/\bip\b|\bemail\b|\baddress\b/i)
    // ...and no attempt counts ("Too many attempts" is generic copy; a number
    // next to it would tell an attacker exactly how much budget they have.)
    expect(body).not.toMatch(/\d+\s*(attempts?|remaining|of)/i)
  })
})

describe('configured limits', () => {
  it('are stricter per-email than per-IP for login', () => {
    expect(RATE_LIMITS.loginByEmail.limit).toBeLessThan(RATE_LIMITS.loginByIp.limit)
  })

  it('are all positive and bounded', () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, name).toBeGreaterThan(0)
      expect(rule.windowSeconds, name).toBeGreaterThan(0)
    }
  })
})
