import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSettings, updateSettings } from '@/lib/supabase/settings'
import {
  listTeamAdmins,
  inviteTeamAdmin,
  removeTeamAdmin,
  TeamError,
} from '@/lib/supabase/teams'
import SettingsShell from '@/components/layout/settings-shell'
import TeamSettingsForm from '@/components/team/team-settings-form'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Settings · Podium',
  description: 'Manage your Podium account, notifications and privacy.',
  robots: { index: false },
}


type TeamRow = Database['public']['Tables']['team_profiles']['Row']
type TeamAdminRole = Database['public']['Enums']['team_admin_role']
type FanReach = Database['public']['Enums']['fan_reach']

const SECTIONS = [
  { id: 'administrators', label: 'Administrators' },
  { id: 'visibility', label: 'Visibility & privacy' },
  { id: 'fan-reach', label: 'Fan-base reach' },
]

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns the row for the role table; cast narrows to TeamRow.
  const profile = (await getOwnProfile(supabase, user.id, 'team')) as TeamRow | null
  if (!profile?.id) redirect('/team/onboarding')

  const teamId = profile.id
  const [admins, settings] = await Promise.all([
    listTeamAdmins(supabase, teamId),
    getSettings(supabase, user.id),
  ])

  const sectionVisibility =
    settings.section_visibility &&
    typeof settings.section_visibility === 'object' &&
    !Array.isArray(settings.section_visibility)
      ? (settings.section_visibility as Record<string, boolean>)
      : {}

  // --- Server actions: keep Supabase out of the client component ----------

  async function onInviteAdmin(invite: { email: string; role: TeamAdminRole }) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await inviteTeamAdmin(sb, teamId, me.id, {
      email: invite.email,
      role: invite.role,
    })
  }

  async function onResendInvite(adminId: string) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    const current = await listTeamAdmins(sb, teamId)
    const target = current.find((a) => a.id === adminId)
    if (!target) {
      throw new TeamError('TEAM_ADMIN_NOT_FOUND', 'Administrator not found')
    }
    // Re-issue the invite using the existing invite primitive (B9). The DB
    // upsert keeps a single pending row per email.
    await inviteTeamAdmin(sb, teamId, me.id, {
      email: target.invited_email,
      role: target.role,
      ...(target.full_name ? { fullName: target.full_name } : {}),
    })
  }

  async function onRemoveAdmin(adminId: string) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await removeTeamAdmin(sb, adminId)
  }

  async function onUpdateVisibility(visible: boolean) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await updateSettings(sb, me.id, { profile_visible: visible })
  }

  async function onUpdateSectionVisibility(section: string, visible: boolean) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    const fresh = await getSettings(sb, me.id)
    const existing =
      fresh.section_visibility &&
      typeof fresh.section_visibility === 'object' &&
      !Array.isArray(fresh.section_visibility)
        ? (fresh.section_visibility as Record<string, boolean>)
        : {}
    await updateSettings(sb, me.id, {
      section_visibility: { ...existing, [section]: visible },
    })
  }

  // role-change and fan-reach quick-edit require Track B helpers that do not
  // exist yet (updateTeamAdmin / updateTeamProfile); see follow-ups. They are
  // surfaced as actions so the UI is complete and ready to wire.
  async function onChangeAdminRole(_adminId: string, _role: TeamAdminRole) {
    'use server'
    throw new TeamError(
      'TEAM_ADMIN_ROLE_UNSUPPORTED',
      'Changing administrator roles requires the updateTeamAdmin helper (pending).',
    )
  }

  async function onUpdateFanReach(_reach: FanReach) {
    'use server'
    throw new TeamError(
      'TEAM_FAN_REACH_UNSUPPORTED',
      'Editing fan-base reach requires the updateTeamProfile helper (pending).',
    )
  }

  return (
    <SettingsShell sections={SECTIONS} active="administrators">
      <TeamSettingsForm
        currentUserId={user.id}
        admins={admins}
        fanReach={profile.fan_reach}
        profileVisible={settings.profile_visible}
        sectionVisibility={sectionVisibility}
        onInviteAdmin={onInviteAdmin}
        onChangeAdminRole={onChangeAdminRole}
        onRemoveAdmin={onRemoveAdmin}
        onResendInvite={onResendInvite}
        onUpdateVisibility={onUpdateVisibility}
        onUpdateSectionVisibility={onUpdateSectionVisibility}
        onUpdateFanReach={onUpdateFanReach}
      />
    </SettingsShell>
  )
}
