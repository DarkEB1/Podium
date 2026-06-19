import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { buttonVariants } from '@/components/ui/button'
import ProfilePreview from '@/components/athlete/profile-preview'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

export default async function OnboardingPreviewPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'athlete') as AthleteRow | null
  if (!profile) redirect('/athlete/onboarding/step/1')

  return (
    <div className="mx-auto min-h-screen max-w-xl px-6 py-12 md:px-16 md:py-16">
      <header className="mb-10 space-y-2">
        <h1 className="text-display text-foreground">Profile preview</h1>
        <p className="text-muted-foreground">This is how brands and agents will see your profile.</p>
      </header>
      <div className="space-y-10 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <ProfilePreview profile={profile} />
        <div className="flex gap-3">
          <Link
            href="/athlete/onboarding/step/6"
            className={buttonVariants({ variant: 'outline' })}
          >
            ← Edit
          </Link>
          <Link
            href="/athlete/dashboard"
            className={buttonVariants()}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
