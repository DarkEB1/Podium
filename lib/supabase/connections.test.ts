import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getIncomingConnectionRequests,
  getOutgoingConnectionRequests,
  countIncomingConnectionRequests,
  CONNECTION_REQUEST_COLUMNS,
  ConnectionsError,
} from './connections'

function makeMockClient() {
  let result: { data: unknown; error: unknown; count?: number | null } = { data: [], error: null }

  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then(resolve: (v: unknown) => void, reject?: ((r: unknown) => void) | null): Promise<unknown> {
      return Promise.resolve(result).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    setResult(data: unknown, error: unknown = null, count: number | null = null) {
      result = { data, error, count }
    },
  }
}

describe('getIncomingConnectionRequests', () => {
  it('queries connection_requests filtered on recipient_id — the accept side', async () => {
    const { client, chain, mockFrom } = makeMockClient()

    await getIncomingConnectionRequests(client, 'user-1')

    expect(mockFrom).toHaveBeenCalledWith('connection_requests')
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'user-1')
  })

  it('projects explicit columns rather than select(*) (SB-10)', async () => {
    const { client, chain } = makeMockClient()

    await getIncomingConnectionRequests(client, 'user-1')

    expect(chain.select).toHaveBeenCalledWith(CONNECTION_REQUEST_COLUMNS)
    expect(CONNECTION_REQUEST_COLUMNS).not.toContain('*')
  })

  it('defaults to pending requests, newest first', async () => {
    const { client, chain } = makeMockClient()

    await getIncomingConnectionRequests(client, 'user-1')

    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
    expect(chain.order).toHaveBeenCalledWith('sent_at', { ascending: false })
  })

  it('honours an explicit status and limit', async () => {
    const { client, chain } = makeMockClient()

    await getIncomingConnectionRequests(client, 'user-1', { status: 'accepted', limit: 10 })

    expect(chain.eq).toHaveBeenCalledWith('status', 'accepted')
    expect(chain.limit).toHaveBeenCalledWith(10)
  })

  it('returns the rows', async () => {
    const { client, setResult } = makeMockClient()
    setResult([{ id: 'cr1' }, { id: 'cr2' }])

    const rows = await getIncomingConnectionRequests(client, 'user-1')

    expect(rows.map((r) => r.id)).toEqual(['cr1', 'cr2'])
  })

  it('returns an empty array when there is nothing pending', async () => {
    const { client, setResult } = makeMockClient()
    setResult(null)

    await expect(getIncomingConnectionRequests(client, 'user-1')).resolves.toEqual([])
  })

  it('throws ConnectionsError on a DB failure', async () => {
    const { client, setResult } = makeMockClient()
    setResult(null, { message: 'permission denied' })

    await expect(getIncomingConnectionRequests(client, 'user-1')).rejects.toBeInstanceOf(
      ConnectionsError
    )
    await expect(getIncomingConnectionRequests(client, 'user-1')).rejects.toMatchObject({
      code: 'INCOMING_REQUESTS_FETCH_FAILED',
    })
  })

  it('is role-agnostic — the same call serves a brand and an athlete inbox', async () => {
    // recipient_id is a FK to users.id, not to a role profile table, so nothing
    // in this accessor may branch on role. Both calls must be identical bar the id.
    const brand = makeMockClient()
    const athlete = makeMockClient()

    await getIncomingConnectionRequests(brand.client, 'brand-user')
    await getIncomingConnectionRequests(athlete.client, 'athlete-user')

    expect(brand.chain.select.mock.calls).toEqual(athlete.chain.select.mock.calls)
    expect(brand.chain.eq.mock.calls[1]).toEqual(athlete.chain.eq.mock.calls[1])
  })
})

describe('getOutgoingConnectionRequests', () => {
  it('filters on sender_id — the send side', async () => {
    const { client, chain } = makeMockClient()

    await getOutgoingConnectionRequests(client, 'user-1')

    expect(chain.eq).toHaveBeenCalledWith('sender_id', 'user-1')
  })

  it('throws its own error code on failure', async () => {
    const { client, setResult } = makeMockClient()
    setResult(null, { message: 'boom' })

    await expect(getOutgoingConnectionRequests(client, 'u1')).rejects.toMatchObject({
      code: 'OUTGOING_REQUESTS_FETCH_FAILED',
    })
  })
})

describe('countIncomingConnectionRequests', () => {
  it('asks for a head-only exact count', async () => {
    const { client, chain, setResult } = makeMockClient()
    setResult(null, null, 3)

    const count = await countIncomingConnectionRequests(client, 'user-1')

    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(count).toBe(3)
  })

  it('reports zero when the count is absent', async () => {
    const { client, setResult } = makeMockClient()
    setResult(null, null, null)

    await expect(countIncomingConnectionRequests(client, 'u1')).resolves.toBe(0)
  })

  it('throws on a DB failure', async () => {
    const { client, setResult } = makeMockClient()
    setResult(null, { message: 'boom' })

    await expect(countIncomingConnectionRequests(client, 'u1')).rejects.toMatchObject({
      code: 'INCOMING_REQUESTS_COUNT_FAILED',
    })
  })
})
