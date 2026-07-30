import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createProfile, getOwnProfile, publishProfile } from '@/lib/supabase/profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Set up your agency · Podium',
  description: 'Tell us about your agency so athletes and brands know who they are dealing with.',
  robots: { index: false },
}


type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

/**
 * B-4 / PR-9 — `/agent/onboarding` is where `role-select`, the agent dashboard
 * and the agent profile page all send an agent with no profile row, but the
 * route did not exist, so picking "Agent" at signup dead-ended on a 404.
 *
 * This creates the `agent_profiles` row. Profile creation is mandatory; only
 * the optional fields below may be left blank.
 */
export default async function AgentOnboardingPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // getOwnProfile returns the role union; role 'agent' narrows it to AgentRow.
  const existing = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null
  if (existing) redirect(ROUTES.agent.profile)

  async function createAgentProfile(formData: FormData) {
    'use server'
    const sb = await createClient()
    const me = await getUser(sb)
    if (!me) redirect(ROUTES.auth.signIn)

    const yearsRaw = formData.get('years_in_industry')
    const years = typeof yearsRaw === 'string' && yearsRaw !== '' ? Number(yearsRaw) : null

    await createProfile(sb, me.id, 'agent', {
      agency_name: formData.get('agency_name'),
      agent_full_name: formData.get('agent_full_name'),
      bio: formData.get('bio'),
      website_url: formData.get('website_url'),
      ...(years !== null && Number.isFinite(years) ? { years_in_industry: years } : {}),
    })

    // createProfile leaves status at the column default of 'draft', which
    // middleware reads as onboarding-in-progress for every role. Agent
    // onboarding is this single form, so publish immediately: without it the
    // agent is redirected back here forever and never reaches the dashboard.
    // (The athlete wizard does the same thing from its final review step.)
    await publishProfile(sb, me.id, 'agent')

    redirect(ROUTES.agent.dashboard)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:px-16 md:py-16">
      <header className="mb-10 space-y-3">
        <p className="text-small font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Set up your agency
        </p>
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          Tell us about your agency
        </h1>
        <p className="text-medium text-muted-foreground">
          This is how athletes, teams and brands see you on Podium. You can refine everything later
          from your profile.
        </p>
      </header>

      <form action={createAgentProfile} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="space-y-2">
          <Label htmlFor="agency_name">Agency name</Label>
          <Input id="agency_name" name="agency_name" required placeholder="Northlight Sports" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent_full_name">Your full name</Label>
          <Input id="agent_full_name" name="agent_full_name" required placeholder="Alex Morgan" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website_url">
            Website <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Input id="website_url" name="website_url" type="url" placeholder="https://example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="years_in_industry">
            Years in the industry <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Input id="years_in_industry" name="years_in_industry" type="number" min={0} max={70} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">
            About your agency <span className="text-small text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="bio" name="bio" rows={5} placeholder="Who you represent and how you work." />
        </div>

        <Button type="submit" className="w-full">
          Create agency profile
        </Button>
      </form>
    </div>
  )
}
