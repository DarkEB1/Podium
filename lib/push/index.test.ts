import { describe, it, expect, afterEach } from 'vitest'
import { pushConfigured, sendWebPush, sendPushToUser } from './index'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']
afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

const fakeSub = { endpoint: 'https://push.example/x', p256dh: 'a', auth: 'b' }

describe('push configuration gating', () => {
  it('is unconfigured without VAPID keys', () => {
    expect(pushConfigured()).toBe(false)
  })

  it('sendWebPush no-ops (skipped) when unconfigured, never throwing', async () => {
    expect(await sendWebPush(fakeSub, { title: 't', body: 'b' })).toEqual({
      status: 'skipped',
      reason: 'no_provider',
    })
  })

  it('sendPushToUser skips and sends nothing when unconfigured', async () => {
    const admin = { from: () => ({}) } as unknown as SupabaseClient<Database>
    expect(await sendPushToUser(admin, 'u1', { title: 't', body: 'b' })).toEqual({ sent: 0, skipped: true })
  })

  it('reports configured when all three keys are present', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    process.env.VAPID_SUBJECT = 'mailto:ops@podium.app'
    expect(pushConfigured()).toBe(true)
  })
})
