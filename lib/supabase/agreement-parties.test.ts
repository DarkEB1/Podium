import { describe, it, expect } from 'vitest'
import { getAgreementPartyContext } from './agreement-parties'

// Mock the Supabase client: `db(client).from(table).select(cols).in(key, ids)`
// resolves to the canned rows for that table.
function mockClient(tables: Record<string, unknown[]>) {
  const from = (table: string) => ({
    select: () => ({
      in: async () => ({ data: tables[table] ?? [], error: null }),
    }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double
  return { from } as any
}

describe('getAgreementPartyContext', () => {
  it('resolves a brand to its legal + trading name and email', async () => {
    const client = mockClient({
      users: [{ id: 'brand1', email: 'deals@northwind.test' }],
      brand_profiles: [{ user_id: 'brand1', company_name: 'Northwind Nutrition Ltd', trading_name: 'Northwind' }],
    })
    const ctx = await getAgreementPartyContext(client, ['brand1'])
    expect(ctx['brand1']!.legalName).toBe('Northwind Nutrition Ltd')
    expect(ctx['brand1']!.company).toBe('Northwind')
    expect(ctx['brand1']!.email).toBe('deals@northwind.test')
  })

  it('resolves an adult athlete to full legal name + sport, not a minor', async () => {
    const client = mockClient({
      users: [{ id: 'ath1', email: 'maya@example.test' }],
      athlete_profiles: [{
        user_id: 'ath1', full_legal_name: 'Maya A. Okafor', display_name: 'Maya Okafor',
        is_under_18: false, primary_sport: 'Athletics',
        guardian_name: null, guardian_relationship: null, guardian_accepted_at: null,
      }],
    })
    const ctx = await getAgreementPartyContext(client, ['ath1'])
    expect(ctx['ath1']!.legalName).toBe('Maya A. Okafor')
    expect(ctx['ath1']!.descriptor).toBe('Athletics')
    expect(ctx['ath1']!.email).toBe('maya@example.test')
    expect(ctx['ath1']!.isMinor).toBe(false)
    expect(ctx['ath1']!.guardian).toBeNull()
  })

  it('surfaces the guardian for a minor athlete who has guardian consent', async () => {
    const client = mockClient({
      users: [{ id: 'ath2', email: 'teen@example.test' }],
      athlete_profiles: [{
        user_id: 'ath2', full_legal_name: 'Sam Young', display_name: 'Sam',
        is_under_18: true, primary_sport: 'Swimming',
        guardian_name: 'Jordan Young', guardian_relationship: 'Parent',
        guardian_accepted_at: '2026-09-01T00:00:00.000Z',
      }],
    })
    const ctx = await getAgreementPartyContext(client, ['ath2'])
    expect(ctx['ath2']!.isMinor).toBe(true)
    expect(ctx['ath2']!.guardian).toEqual({ name: 'Jordan Young', relationship: 'Parent' })
  })

  it('does not fabricate a guardian for a minor without recorded consent', async () => {
    const client = mockClient({
      users: [{ id: 'ath3', email: 't@example.test' }],
      athlete_profiles: [{
        user_id: 'ath3', full_legal_name: 'Kid Player', display_name: 'Kid',
        is_under_18: true, primary_sport: null,
        guardian_name: 'Some Parent', guardian_relationship: 'Parent',
        guardian_accepted_at: null,
      }],
    })
    const ctx = await getAgreementPartyContext(client, ['ath3'])
    expect(ctx['ath3']!.isMinor).toBe(true)
    expect(ctx['ath3']!.guardian).toBeNull()
  })

  it('resolves a team to its name and signing controller (name + title)', async () => {
    const client = mockClient({
      users: [{ id: 'team1', email: 'ops@team.test' }],
      team_profiles: [{
        user_id: 'team1', team_name: 'Example United',
        primary_controller_name: 'Dana Lee', primary_controller_role: 'Commercial Director',
        primary_controller_email: 'dana@team.test',
      }],
    })
    const ctx = await getAgreementPartyContext(client, ['team1'])
    expect(ctx['team1']!.legalName).toBe('Example United')
    expect(ctx['team1']!.representativeName).toBe('Dana Lee')
    expect(ctx['team1']!.representativeTitle).toBe('Commercial Director')
    expect(ctx['team1']!.email).toBe('dana@team.test')
  })

  it('returns a safe empty detail for an unknown id', async () => {
    const client = mockClient({ users: [] })
    const ctx = await getAgreementPartyContext(client, ['ghost'])
    expect(ctx['ghost']!.legalName).toBeNull()
    expect(ctx['ghost']!.isMinor).toBe(false)
    expect(ctx['ghost']!.guardian).toBeNull()
  })

  it('returns an empty object for no ids without querying', async () => {
    const client = mockClient({})
    const ctx = await getAgreementPartyContext(client, [])
    expect(ctx).toEqual({})
  })
})
