import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { createTeamProfile } from '@/lib/supabase/teams'
import { Card, CardContent } from '@/components/ui/card'
import TeamProfileForm from '@/components/team/team-profile-form'
import type { Database } from '@/types/database'

type TeamRow = Database['public']['Tables']['team_profiles']['Row']
// The wizard never supplies user_id — createTeamProfile attaches it.
type TeamInsert = Omit<
  Database['public']['Tables']['team_profiles']['Insert'],
  'user_id'
>

export default async function TeamOnboardingPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns the row for the role table; cast narrows to TeamRow.
  const profile = (await getOwnProfile(supabase, user.id, 'team')) as TeamRow | null
  if (profile?.id) redirect('/team/onboarding/step/2')

  // Server action: persists via createTeamProfile (B9), keeping Supabase out of
  // the client wizard per architecture rules.
  async function onCreate(data: TeamInsert): Promise<{ id: string }> {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect('/auth')
    // createTeamProfile attaches user_id itself; the wizard payload omits it.
    const created = await createTeamProfile(
      sb,
      me.id,
      data as Database['public']['Tables']['team_profiles']['Insert']
    )
    return { id: created.id }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:px-16 md:py-16">
      <header className="mb-10">
        <h1 className="text-display text-foreground">Create your team profile</h1>
        <p className="mt-3 text-medium text-muted-foreground">
          Tell sponsors who you are and what you&rsquo;re looking for. You can
          refine everything later.
        </p>
      </header>
      <Card className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <CardContent className="p-6 md:p-8">
          <TeamProfileForm
            onCreate={onCreate}
            initialLogoUrl={profile?.logo_url ?? null}
            initialCoverUrl={profile?.cover_photo_url ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
