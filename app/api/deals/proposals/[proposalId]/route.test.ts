import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/deals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/deals')>()
  return { ...actual, withdrawProposal: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { withdrawProposal, DealsError } from '@/lib/supabase/deals'
import { DELETE } from './route'

const fakeUser = { id: 'user-1', email: 'test@example.com', role: 'brand' as const, role_locked_at: '2026-04-19T00:00:00Z' }
const params = Promise.resolve({ proposalId: 'p1' })

function makeDeleteRequest() {
  return new NextRequest(new URL('/api/deals/proposals/p1', 'http://localhost'), { method: 'DELETE' })
}

describe('DELETE /api/deals/proposals/[proposalId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(401)
  })

  it('returns 200 with success on withdrawal', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(withdrawProposal).mockResolvedValue(undefined)
    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('calls withdrawProposal with proposalId and userId', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(withdrawProposal).mockResolvedValue(undefined)
    await DELETE(makeDeleteRequest(), { params })
    expect(withdrawProposal).toHaveBeenCalledWith(expect.anything(), 'p1', 'user-1')
  })

  it('returns 404 when proposal not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(withdrawProposal).mockRejectedValue(new DealsError('PROPOSAL_NOT_FOUND', 'Not found'))
    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_NOT_FOUND')
  })

  it('returns 500 when DB error prevents withdrawal', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(withdrawProposal).mockRejectedValue(new DealsError('PROPOSAL_WITHDRAW_FAILED', 'DB error'))
    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe('PROPOSAL_WITHDRAW_FAILED')
  })
})
