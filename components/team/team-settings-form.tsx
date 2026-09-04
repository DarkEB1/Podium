'use client'

import { useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { TeamAdmin } from '@/lib/supabase/teams'
import type { Database } from '@/types/database'

type TeamAdminRole = Database['public']['Enums']['team_admin_role']
type FanReach = Database['public']['Enums']['fan_reach']

const ROLE_OPTIONS: { value: TeamAdminRole; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'standard', label: 'Standard' },
  { value: 'view_only', label: 'View Only' },
]

const FAN_REACH_OPTIONS: { value: FanReach; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'regional', label: 'Regional' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
]

// Public-facing profile sections a team can choose to expose (spec §5B). These
// are display keys persisted in profile_settings.section_visibility (jsonb).
const PUBLIC_SECTIONS: { key: string; label: string }[] = [
  { key: 'contact', label: 'Contact details' },
  { key: 'financials', label: 'Financials' },
  { key: 'fan_reach', label: 'Fan-base reach' },
  { key: 'social', label: 'Social accounts' },
]

function roleLabel(role: TeamAdminRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
}

function lastActive(admin: TeamAdmin): string {
  if (admin.invite_status !== 'accepted') return 'Invite pending'
  const iso = admin.accepted_at ?? admin.updated_at
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Unknown'
  }
}

export interface TeamSettingsFormProps {
  currentUserId: string
  admins: TeamAdmin[]
  fanReach: FanReach | null
  profileVisible: boolean
  sectionVisibility: Record<string, boolean>
  onInviteAdmin: (invite: { email: string; role: TeamAdminRole }) => Promise<void>
  onChangeAdminRole: (adminId: string, role: TeamAdminRole) => Promise<void>
  onRemoveAdmin: (adminId: string) => Promise<void>
  onResendInvite: (adminId: string) => Promise<void>
  onUpdateVisibility: (visible: boolean) => Promise<void>
  onUpdateSectionVisibility: (section: string, visible: boolean) => Promise<void>
  onUpdateFanReach: (reach: FanReach) => Promise<void>
}

export default function TeamSettingsForm({
  currentUserId,
  admins,
  fanReach,
  profileVisible,
  sectionVisibility,
  onInviteAdmin,
  onChangeAdminRole,
  onRemoveAdmin,
  onResendInvite,
  onUpdateVisibility,
  onUpdateSectionVisibility,
  onUpdateFanReach,
}: TeamSettingsFormProps) {
  const inviteEmailId = useId()

  const [visible, setVisible] = useState(profileVisible)
  const [sections, setSections] = useState<Record<string, boolean>>(
    sectionVisibility ?? {},
  )
  const [reach, setReach] = useState<FanReach | ''>(fanReach ?? '')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamAdminRole>('standard')
  const [inviting, setInviting] = useState(false)

  // Inline confirm-before-remove: holds the admin id pending confirmation so
  // removal is never one-click (spec §5B "remove + confirm").
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)

  async function run(fn: () => Promise<void>, errorMsg: string) {
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorMsg)
    }
  }

  async function handleChangeRole(adminId: string, role: TeamAdminRole) {
    await run(
      () => onChangeAdminRole(adminId, role),
      'Failed to update administrator role',
    )
  }

  async function handleRemove(adminId: string) {
    await run(() => onRemoveAdmin(adminId), 'Failed to remove administrator')
    setPendingRemoval(null)
  }

  async function handleResend(adminId: string) {
    // PM-14: only report success when the action actually succeeded. The old
    // code toasted "Invite resent." unconditionally, even though the underlying
    // insert failed the unique index every time.
    try {
      await onResendInvite(adminId)
      toast.success('Invite resent.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invite')
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    try {
      await onInviteAdmin({ email, role: inviteRole })
      toast.success('Invitation sent.')
      setInviteEmail('')
      setInviteRole('standard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleVisibility(next: boolean) {
    setVisible(next)
    await run(() => onUpdateVisibility(next), 'Failed to update visibility')
  }

  async function handleSection(key: string, next: boolean) {
    setSections((prev) => ({ ...prev, [key]: next }))
    await run(
      () => onUpdateSectionVisibility(key, next),
      'Failed to update section visibility',
    )
  }

  async function handleReach(next: FanReach) {
    setReach(next)
    await run(() => onUpdateFanReach(next), 'Failed to update fan-base reach')
  }

  const selectClass = cn(
    'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-medium shadow-xs',
    'focus-visible:ring-2 focus-visible:ring-ring outline-none',
  )

  return (
    <div className="space-y-16">
      {/* ----------------------------------------------------------------- */}
      {/* Administrators                                                     */}
      {/* ----------------------------------------------------------------- */}
      <section id="administrators" aria-labelledby="admins-heading" className="space-y-4">
        <div>
          <h2 id="admins-heading" className="font-heading text-large">
            Administrators
          </h2>
          <p className="text-small text-muted-foreground">
            Manage who can access and edit your team. Primary administrators can
            invite or remove others; View Only administrators cannot make changes.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-medium" aria-label="Administrator list">
            <thead className="text-small text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-2 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Email
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Role
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Last active
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isYou = admin.user_id === currentUserId
                const unaccepted = admin.invite_status !== 'accepted'
                const name = admin.full_name ?? (unaccepted ? 'Invited' : 'Not set')
                const confirming = pendingRemoval === admin.id
                return (
                  <tr key={admin.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {name}
                      {isYou ? (
                        <span className="ml-1 text-small text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {admin.invited_email}
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`role-${admin.id}`}>
                        Role for {admin.invited_email}
                      </label>
                      <select
                        id={`role-${admin.id}`}
                        className={selectClass}
                        value={admin.role}
                        disabled={isYou}
                        onChange={(e) =>
                          handleChangeRole(admin.id, e.target.value as TeamAdminRole)
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-small text-muted-foreground">
                      {lastActive(admin)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {unaccepted ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Resend invite to ${admin.invited_email}`}
                            onClick={() => handleResend(admin.id)}
                          >
                            Resend invite
                          </Button>
                        ) : null}
                        {isYou ? null : confirming ? (
                          <>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemove(admin.id)}
                            >
                              Confirm removal
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingRemoval(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${admin.invited_email}`}
                            onClick={() => setPendingRemoval(admin.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Invite a new administrator */}
        <form
          onSubmit={handleInvite}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-end"
          aria-label="Invite administrator"
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor={inviteEmailId}>Invite by email</Label>
            <Input
              id={inviteEmailId}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@club.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              aria-label="Role for new administrator"
              className={cn(selectClass, 'w-full sm:w-auto')}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamAdminRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Visibility & privacy                                               */}
      {/* ----------------------------------------------------------------- */}
      <section id="visibility" aria-labelledby="visibility-heading" className="space-y-4">
        <div>
          <h2 id="visibility-heading" className="font-heading text-large">
            Visibility &amp; privacy
          </h2>
          <p className="text-small text-muted-foreground">
            Controls who can find and view your team across the marketplace. When
            visible, sponsors can discover your profile and send proposals.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="pr-4">
            <p className="text-medium font-medium">Team profile is visible</p>
            <p className="text-small text-muted-foreground">
              {visible
                ? 'Your team appears in discovery and search.'
                : 'Your team is hidden from discovery and search.'}
            </p>
          </div>
          <Switch
            aria-label="Team profile is visible"
            checked={visible}
            onCheckedChange={handleVisibility}
          />
        </div>

        <fieldset className="space-y-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <legend className="text-medium font-medium">
            Public sections
          </legend>
          <p className="text-small text-muted-foreground">
            Choose which parts of your profile are visible to the public.
          </p>
          <ul className="divide-y">
            {PUBLIC_SECTIONS.map((section) => {
              const on = sections[section.key] ?? false
              return (
                <li
                  key={section.key}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-medium">{section.label}</span>
                  <Switch
                    size="sm"
                    aria-label={`Show ${section.label.toLowerCase()} publicly`}
                    checked={on}
                    onCheckedChange={(next) => handleSection(section.key, next)}
                  />
                </li>
              )
            })}
          </ul>
        </fieldset>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Fan-base reach quick-edit                                          */}
      {/* ----------------------------------------------------------------- */}
      <section id="fan-reach" aria-labelledby="reach-heading" className="space-y-4">
        <div>
          <h2 id="reach-heading" className="font-heading text-large">
            Fan-base reach
          </h2>
          <p className="text-small text-muted-foreground">
            A quick estimate of your audience footprint, shown to sponsors on your
            profile and discovery card.
          </p>
        </div>
        <div className="max-w-xs space-y-1">
          <Label htmlFor="fan-reach">Fan-base reach</Label>
          <select
            id="fan-reach"
            aria-label="Fan-base reach"
            className={cn(selectClass, 'w-full')}
            value={reach}
            onChange={(e) => handleReach(e.target.value as FanReach)}
          >
            <option value="" disabled>
              Select reach
            </option>
            {FAN_REACH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  )
}

export { roleLabel }
