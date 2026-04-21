import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getMatches } from '@/lib/supabase/messaging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function AthleteDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, matches] = await Promise.all([
    getOwnProfile(supabase, user.id, 'athlete') as Promise<AthleteRow | null>,
    getMatches(supabase, user.id) as Promise<MatchRow[]>,
  ])

  if (!profile) redirect('/athlete/onboarding')
  if (profile.status === 'draft') redirect('/athlete/onboarding/step/1')

  const activeMatches = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {profile.display_name}</h1>
        <p className="text-muted-foreground">
          {profile.status === 'pending_review'
            ? 'Your profile is under review. We will notify you when it goes live.'
            : 'Your profile is live.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeMatches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{profile.primary_sport ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile status</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              profile.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            )}>
              {profile.status.replace('_', ' ')}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/athlete/discover" className={buttonVariants()}>Browse brands</Link>
        <Link href="/athlete/messages" className={buttonVariants({ variant: 'outline' })}>Messages ({activeMatches.length})</Link>
        <Link href="/athlete/requests" className={buttonVariants({ variant: 'outline' })}>Connection requests</Link>
      </div>
    </div>
  )
}
