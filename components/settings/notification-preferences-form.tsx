'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EMAIL_EVENTS, type EmailEvent } from '@/lib/email/types'

/**
 * Notification preferences form (CL-4). Cross-role: it edits
 * profile_settings.notification_matrix (per-event email toggles), the digest
 * cadence, and the marketing opt-in — the single store all roles share.
 *
 * Reached from /settings/notifications, which every transactional email footer
 * links to. Saves via PATCH /api/settings/notifications.
 */

const EVENTS = Object.entries(EMAIL_EVENTS) as [EmailEvent, (typeof EMAIL_EVENTS)[EmailEvent]][]

export interface NotificationPreferences {
  emailByEvent: Record<string, boolean>
  marketingOptIn: boolean
}

export default function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPreferences
}) {
  const [emailByEvent, setEmailByEvent] = useState<Record<string, boolean>>(initial.emailByEvent)
  const [marketing, setMarketing] = useState(initial.marketingOptIn)
  const [saving, setSaving] = useState(false)

  function toggle(event: EmailEvent) {
    setEmailByEvent((prev) => ({ ...prev, [event]: !(prev[event] ?? EMAIL_EVENTS[event].defaultEmail) }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailByEvent, marketing_opt_in: marketing }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        toast.error(data.error?.message ?? 'Could not save your preferences.')
        return
      }
      toast.success('Preferences saved')
    } catch {
      toast.error('Could not save your preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground">Email notifications</h2>
        <p className="mt-1 text-small text-muted-foreground">
          Choose which emails Podium sends you. Turning one off will not stop the others.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {EVENTS.map(([event, def]) => {
            const checked = emailByEvent[event] ?? def.defaultEmail
            return (
              <li key={event} className="flex items-center justify-between gap-4 px-4 py-3">
                <label htmlFor={`email-${event}`} className="text-medium text-foreground">
                  {def.label}
                </label>
                <input
                  id={`email-${event}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(event)}
                  className="size-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <label htmlFor="marketing" className="text-medium text-foreground">
            Product news and offers
            <span className="mt-0.5 block text-small text-muted-foreground">
              Occasional updates. Off unless you opt in.
            </span>
          </label>
          <input
            id="marketing"
            type="checkbox"
            checked={marketing}
            onChange={() => setMarketing((v) => !v)}
            className="size-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>
      </section>

      <Button type="button" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  )
}
