import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Profile preview</CardTitle>
          <CardDescription>This is how brands and agents will see your profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
        </CardContent>
      </Card>
    </div>
  )
}
