import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock every IO boundary so no real DB / provider call happens.
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/email', () => ({
  claimDelivery: vi.fn(),
  markDelivery: vi.fn(),
  isSuppressed: vi.fn(),
  getUserEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/settings', () => ({
  getNotificationMatrix: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('./provider', () => ({
  sendViaProvider: vi.fn(),
}))

vi.mock('@/lib/observability', () => ({
  captureException: vi.fn(),
}))

import { sendTransactionalEmail } from './index'
import { claimDelivery, markDelivery, isSuppressed, getUserEmail } from '@/lib/supabase/email'
import { getNotificationMatrix, getSettings } from '@/lib/supabase/settings'
import { sendViaProvider } from './provider'
import { captureException } from '@/lib/observability'
import type { NotificationMatrix, ProfileSettings } from '@/lib/supabase/settings'

const claimDeliveryMock = vi.mocked(claimDelivery)
const markDeliveryMock = vi.mocked(markDelivery)
const isSuppressedMock = vi.mocked(isSuppressed)
const getUserEmailMock = vi.mocked(getUserEmail)
const getNotificationMatrixMock = vi.mocked(getNotificationMatrix)
const getSettingsMock = vi.mocked(getSettings)
const sendViaProviderMock = vi.mocked(sendViaProvider)
const captureExceptionMock = vi.mocked(captureException)

// A dummy admin client — every accessor that touches it is mocked.
const admin = {} as unknown as SupabaseClient<Database>

const RECIPIENT = 'secret-user@example.com'

// profile_settings has many columns; the send path reads only marketing_opt_in.
const settingsWith = (marketingOptIn: boolean): ProfileSettings =>
  ({ marketing_opt_in: marketingOptIn }) as unknown as ProfileSettings

const proposalParams = {
  event: 'proposal_received' as const,
  userId: 'u1',
  data: {
    recipientName: 'Maya',
    senderName: 'Northwind',
    proposalTitle: 'Summer campaign',
    url: 'https://app.podium.test/proposals/1',
  },
}

beforeEach(() => {
  // Happy-path defaults; individual tests override.
  getUserEmailMock.mockResolvedValue(RECIPIENT)
  getSettingsMock.mockResolvedValue(settingsWith(true))
  getNotificationMatrixMock.mockResolvedValue({} as NotificationMatrix)
  isSuppressedMock.mockResolvedValue(false)
  claimDeliveryMock.mockResolvedValue({ id: 'd1', claimed: true })
  markDeliveryMock.mockResolvedValue(undefined)
  sendViaProviderMock.mockResolvedValue({ ok: true, providerId: 'p1' })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Gating: address, preferences, suppression, idempotency.
// ---------------------------------------------------------------------------

describe('sendTransactionalEmail — gating', () => {
  it('skips with no_address when the user has no email', async () => {
    getUserEmailMock.mockResolvedValue(null)

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res).toEqual({ status: 'skipped', reason: 'no_address' })
    expect(sendViaProviderMock).not.toHaveBeenCalled()
  })

  it('skips with preferences when the matrix disables the event email channel', async () => {
    getNotificationMatrixMock.mockResolvedValue({
      proposal_received: { email: false },
    } as NotificationMatrix)

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res).toEqual({ status: 'skipped', reason: 'preferences' })
    expect(sendViaProviderMock).not.toHaveBeenCalled()
  })

  it('respects the per-event DEFAULT (transactional defaults ON) when the matrix has no entry', async () => {
    getNotificationMatrixMock.mockResolvedValue({} as NotificationMatrix)

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res.status).toBe('sent')
    expect(sendViaProviderMock).toHaveBeenCalledTimes(1)
  })

  it('a transactional event does NOT require the marketing opt-in', async () => {
    // marketing_opt_in false must not block a transactional (service) message.
    getSettingsMock.mockResolvedValue(settingsWith(false))

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res.status).toBe('sent')
  })

  it('skips with suppressed when the address is on the suppression list', async () => {
    isSuppressedMock.mockResolvedValue(true)

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res).toEqual({ status: 'skipped', reason: 'suppressed' })
    expect(claimDeliveryMock).not.toHaveBeenCalled()
    expect(sendViaProviderMock).not.toHaveBeenCalled()
  })

  it('skips with duplicate when claimDelivery reports the key already claimed', async () => {
    claimDeliveryMock.mockResolvedValue({ id: 'd1', claimed: false })

    const res = await sendTransactionalEmail(admin, {
      ...proposalParams,
      idempotencyKey: 'proposal:1',
    })

    expect(res).toEqual({ status: 'skipped', reason: 'duplicate' })
    expect(sendViaProviderMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Delivery: success, retry, failure.
// ---------------------------------------------------------------------------

describe('sendTransactionalEmail — delivery', () => {
  it('sends and marks the delivery row status "sent" on a successful provider send', async () => {
    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res).toMatchObject({ status: 'sent', deliveryId: 'd1', providerId: 'p1' })
    expect(markDeliveryMock).toHaveBeenCalledWith(
      admin,
      'd1',
      expect.objectContaining({ status: 'sent', providerId: 'p1' })
    )
  })

  it('records status "skipped" (no_provider) when the transport is a no-op', async () => {
    sendViaProviderMock.mockResolvedValue({
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY not configured',
    })

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res).toEqual({ status: 'skipped', reason: 'no_provider' })
    expect(markDeliveryMock).toHaveBeenCalledWith(
      admin,
      'd1',
      expect.objectContaining({ status: 'skipped' })
    )
  })

  it('retries a retriable failure and eventually succeeds', async () => {
    vi.useFakeTimers()
    sendViaProviderMock
      .mockResolvedValueOnce({ ok: false, retriable: true, error: 'temporary' })
      .mockResolvedValueOnce({ ok: true, providerId: 'p2' })

    const promise = sendTransactionalEmail(admin, proposalParams)
    await vi.runAllTimersAsync()
    const res = await promise
    vi.useRealTimers()

    expect(sendViaProviderMock.mock.calls.length).toBeGreaterThan(1)
    expect(res).toMatchObject({ status: 'sent', providerId: 'p2' })
  })

  it('fails after all attempts and marks the row "failed"', async () => {
    vi.useFakeTimers()
    sendViaProviderMock.mockResolvedValue({ ok: false, retriable: true, error: 'boom' })

    const promise = sendTransactionalEmail(admin, proposalParams)
    await vi.runAllTimersAsync()
    const res = await promise
    vi.useRealTimers()

    expect(res).toMatchObject({ status: 'failed', deliveryId: 'd1', error: 'boom' })
    expect(markDeliveryMock).toHaveBeenCalledWith(
      admin,
      'd1',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('stops immediately on a non-retriable failure (no retry)', async () => {
    sendViaProviderMock.mockResolvedValue({ ok: false, retriable: false, error: 'bad address' })

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(sendViaProviderMock).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ status: 'failed', error: 'bad address' })
  })
})

// ---------------------------------------------------------------------------
// Robustness + privacy.
// ---------------------------------------------------------------------------

describe('sendTransactionalEmail — robustness and privacy', () => {
  it('never throws even when an accessor throws — returns status "error"', async () => {
    getUserEmailMock.mockRejectedValue(new Error('db down'))

    const res = await sendTransactionalEmail(admin, proposalParams)

    expect(res.status).toBe('error')
  })

  it('never logs or returns the recipient email address on the failure path', async () => {
    vi.useFakeTimers()
    sendViaProviderMock.mockResolvedValue({ ok: false, retriable: true, error: 'boom' })

    const promise = sendTransactionalEmail(admin, proposalParams)
    await vi.runAllTimersAsync()
    const res = await promise
    vi.useRealTimers()

    // The address is not in the returned result...
    expect(JSON.stringify(res)).not.toContain(RECIPIENT)
    // ...nor in anything handed to observability.
    expect(captureExceptionMock).toHaveBeenCalled()
    const logged = JSON.stringify(captureExceptionMock.mock.calls)
    expect(logged).not.toContain(RECIPIENT)
  })
})
