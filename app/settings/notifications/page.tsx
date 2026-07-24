import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getNotificationMatrix, getSettings } from '@/lib/supabase/settings'
import { ROUTES } from '@/lib/routes'
import { EMAIL_EVENTS, type EmailEvent } from '@/lib/email/types'
import NotificationPreferencesForm, {
  type NotificationPreferences,
} from '@/components/settings/notification-preferences-form'

export const metadata: Metadata = {
  title: 'Email preferences · Podium',
  description: 'Choose which emails Podium sends you.',
  robots: { index: false },
}

/**
 * Cross-role notification preferences (CL-4). Standalone (outside the role
 * shells) because profile_settings is role-agnostic and this page is reached
 * from an email footer link, where the user's role is not part of the URL.
 */
export default async function NotificationSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const [settings, matrix] = await Promise.all([
    getSettings(supabase, user.id),
    getNotificationMatrix(supabase, user.id),
  ])

  const emailByEvent: Record<string, boolean> = {}
  for (const event of Object.keys(EMAIL_EVENTS) as EmailEvent[]) {
    emailByEvent[event] = matrix[event]?.email ?? EMAIL_EVENTS[event].defaultEmail
  }

  const initial: NotificationPreferences = {
    emailByEvent,
    marketingOptIn: settings.marketing_opt_in,
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 md:px-10 md:py-16">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Email preferences
        </h1>
        <p className="mt-2 text-medium text-muted-foreground">
          Manage the emails Podium sends you.
        </p>
      </header>
      <NotificationPreferencesForm initial={initial} />
    </main>
  )
}
