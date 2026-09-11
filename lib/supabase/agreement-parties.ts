import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

/**
 * Rich per-party detail for rendering the full sponsorship agreement PDF.
 *
 * `getSenderDisplayNames` resolves only a single display label per user; a legal
 * contract also needs each party's full legal / entity name, contact email, a
 * signing representative for entities, and — for a minor athlete — the guardian
 * who co-signs. This probes the same four role tables (plus `users` for email)
 * with `.in(...)`, so it is a fixed five queries regardless of party count.
 */
export interface AgreementPartyDetail {
  legalName: string | null
  company: string | null
  email: string | null
  address: string | null
  descriptor: string | null
  representativeName: string | null
  representativeTitle: string | null
  isMinor: boolean
  guardian: { name: string; relationship: string | null } | null
}

function emptyDetail(): AgreementPartyDetail {
  return {
    legalName: null,
    company: null,
    email: null,
    address: null,
    descriptor: null,
    representativeName: null,
    representativeTitle: null,
    isMinor: false,
    guardian: null,
  }
}

export async function getAgreementPartyContext(
  supabase: SupabaseClient<Database>,
  userIds: readonly string[]
): Promise<Record<string, AgreementPartyDetail>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return {}

  const client = db(supabase)
  const out: Record<string, AgreementPartyDetail> = {}
  for (const id of ids) out[id] = emptyDetail()

  const [users, athletes, teams, brands, agents] = await Promise.all([
    client.from('users').select('id, email').in('id', ids),
    client
      .from('athlete_profiles')
      .select('user_id, full_legal_name, display_name, is_under_18, primary_sport, address, guardian_name, guardian_relationship, guardian_accepted_at')
      .in('user_id', ids),
    client
      .from('team_profiles')
      .select('user_id, team_name, primary_controller_name, primary_controller_role, primary_controller_email, registered_address')
      .in('user_id', ids),
    client
      .from('brand_profiles')
      .select('user_id, company_name, trading_name, registered_address, representative_name, representative_title')
      .in('user_id', ids),
    client.from('agent_profiles').select('user_id, agency_name, agent_full_name').in('user_id', ids),
  ])

  for (const row of (users.data ?? []) as { id: string; email: string | null }[]) {
    const d = out[row.id]
    if (d) d.email = row.email ?? d.email
  }

  for (const row of (brands.data ?? []) as {
    user_id: string
    company_name: string
    trading_name: string | null
    registered_address: string | null
    representative_name: string | null
    representative_title: string | null
  }[]) {
    const d = out[row.user_id]
    if (!d) continue
    d.legalName = row.company_name
    d.company = row.trading_name ?? row.company_name
    d.address = row.registered_address
    d.representativeName = row.representative_name
    d.representativeTitle = row.representative_title
  }

  for (const row of (agents.data ?? []) as {
    user_id: string
    agency_name: string | null
    agent_full_name: string | null
  }[]) {
    const d = out[row.user_id]
    if (!d) continue
    d.legalName = row.agency_name ?? row.agent_full_name
    d.representativeName = row.agent_full_name
  }

  for (const row of (teams.data ?? []) as {
    user_id: string
    team_name: string | null
    primary_controller_name: string | null
    primary_controller_role: string | null
    primary_controller_email: string | null
    registered_address: string | null
  }[]) {
    const d = out[row.user_id]
    if (!d) continue
    d.legalName = row.team_name
    d.representativeName = row.primary_controller_name
    d.representativeTitle = row.primary_controller_role
    d.address = row.registered_address
    if (row.primary_controller_email) d.email = row.primary_controller_email
  }

  for (const row of (athletes.data ?? []) as {
    user_id: string
    full_legal_name: string | null
    display_name: string | null
    is_under_18: boolean
    primary_sport: string | null
    address: string | null
    guardian_name: string | null
    guardian_relationship: string | null
    guardian_accepted_at: string | null
  }[]) {
    const d = out[row.user_id]
    if (!d) continue
    d.legalName = row.full_legal_name ?? row.display_name
    d.descriptor = row.primary_sport
    d.address = row.address
    d.isMinor = row.is_under_18
    // Only surface the guardian once consent is actually recorded — the co-sign
    // statement must reflect a real, obtained consent, never a placeholder.
    if (row.is_under_18 && row.guardian_accepted_at && row.guardian_name) {
      d.guardian = { name: row.guardian_name, relationship: row.guardian_relationship }
    }
  }

  return out
}
