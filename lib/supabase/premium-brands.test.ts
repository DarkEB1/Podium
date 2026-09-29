import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPremiumBrandUserIds } from './premium-brands'

function client(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => result)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('getPremiumBrandUserIds', () => {
  it('returns an empty set without a round trip when there are no ids', async () => {
    const { client: c, rpc } = client({ data: ['x'], error: null })
    expect(await getPremiumBrandUserIds(c, [null, undefined, ''])).toEqual(new Set())
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls the premium_brand_user_ids function with the de-duplicated ids', async () => {
    const { client: c, rpc } = client({ data: ['b1'], error: null })
    const res = await getPremiumBrandUserIds(c, ['b1', 'b2', 'b1', null])
    expect(rpc).toHaveBeenCalledWith('premium_brand_user_ids', { p_user_ids: ['b1', 'b2'] })
    expect(res).toEqual(new Set(['b1']))
  })

  it('degrades to no badges on an error instead of throwing', async () => {
    const { client: c } = client({ data: null, error: { message: 'boom' } })
    expect(await getPremiumBrandUserIds(c, ['b1'])).toEqual(new Set())
  })
})
