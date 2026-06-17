import { describe, it, expect, vi } from 'vitest'
import {
  getAgentClients,
  getAgentDealPipeline,
  applyForVerification,
  AgentError,
} from './agents'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeMockClient() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const listQueue: Array<{ data: unknown; error: unknown }> = []

  const mockSingle = vi.fn().mockImplementation(() => {
    const r = singleQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

  const chain = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    then(
      resolve: (v: unknown) => void,
      reject?: ((reason: unknown) => void) | null
    ): Promise<unknown> {
      const r = listQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
    },
    queueList(data: unknown, error: unknown = null) {
      listQueue.push({ data, error })
    },
  }
}

describe('getAgentClients', () => {
  it('queries representation_links for the agent', async () => {
    const m = makeMockClient()
    m.queueList([{ id: 'r1', agent_id: 'agent-1' }])
    const result = await getAgentClients(m.client, 'agent-1')
    expect(result).toHaveLength(1)
    expect(m.mockFrom).toHaveBeenCalledWith('representation_links')
    expect(m.chain.eq).toHaveBeenCalledWith('agent_id', 'agent-1')
  })

  it('throws AgentError on failure', async () => {
    const m = makeMockClient()
    m.queueList(null, { message: 'boom' })
    await expect(getAgentClients(m.client, 'agent-1')).rejects.toBeInstanceOf(AgentError)
  })
})

describe('getAgentDealPipeline', () => {
  it('queries contracts for the agent', async () => {
    const m = makeMockClient()
    m.queueList([{ id: 'c1', agent_id: 'agent-1', status: 'pending_signatures' }])
    const result = await getAgentDealPipeline(m.client, 'agent-1')
    expect(result).toHaveLength(1)
    expect(m.mockFrom).toHaveBeenCalledWith('contracts')
    expect(m.chain.eq).toHaveBeenCalledWith('agent_id', 'agent-1')
  })
})

describe('applyForVerification', () => {
  it('sets verification_status to pending', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'agent-1', verification_status: 'pending' })
    const result = await applyForVerification(m.client, 'agent-1')
    expect(result.verification_status).toBe('pending')
    expect(m.chain.update).toHaveBeenCalledWith({ verification_status: 'pending' })
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'agent-1')
  })

  it('maps PGRST116 to AGENT_NOT_FOUND', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { code: 'PGRST116', message: 'no rows' })
    await expect(applyForVerification(m.client, 'missing')).rejects.toMatchObject({
      code: 'AGENT_NOT_FOUND',
    })
  })
})
