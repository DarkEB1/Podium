import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSettings, updateSettings } from '@/lib/supabase/settings'
import {
  listTeamAdmins,
  inviteTeamAdmin,
  updateTeamAdmin,
  resendTeamAdminInvite,
  removeTeamAdmin,
  updateTeamProfile,
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
    revalidatePath('/team/settings')
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
    // PM-14: re-issue via an UPSERT on (team_id, invited_email). The old path
    // ran a plain insert that violated the unique index every time while the UI
    // still toasted success. This surfaces a real error and keeps one row.
    await resendTeamAdminInvite(sb, teamId, me.id, {
      email: target.invited_email,
      role: target.role,
      ...(target.full_name ? { fullName: target.full_name } : {}),
    })
    revalidatePath('/team/settings')
  }

  async function onRemoveAdmin(adminId: string) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await removeTeamAdmin(sb, adminId)
    revalidatePath('/team/settings')
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

  // WS-PROFILE-02: previously these threw "helper (pending)". Now wired to the
  // real teams helpers, so administrator roles and fan-base reach are editable
  // after onboarding.
  async function onChangeAdminRole(adminId: string, role: TeamAdminRole) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await updateTeamAdmin(sb, adminId, { role })
    revalidatePath('/team/settings')
  }

  async function onUpdateFanReach(reach: FanReach) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    await updateTeamProfile(sb, me.id, { fan_reach: reach })
    revalidatePath('/team/settings')
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
