import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { buttonVariants } from '@/components/ui/button'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Your brand profile · Podium',
  description: 'How your brand appears to athletes, teams and agents on Podium.',
  robots: { index: false },
}


type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * B-4 — the brand nav's "Profile" item pointed at `/brand/profile`, which did
 * not exist. This renders the brand's company profile as athletes and teams
 * see it; editing stays in Settings, which already hosts the form.
 */
export default async function BrandProfilePage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // getOwnProfile returns the role union; role 'brand' narrows it to BrandRow.
  const profile = (await getOwnProfile(supabase, user.id, 'brand')) as BrandRow | null
  if (!profile) redirect(ROUTES.brand.onboarding)

  const location = [profile.headquarters_city, profile.headquarters_country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 space-y-3">
          <AccentHeading as="h1" className="text-display">
            {profile.company_name}
          </AccentHeading>
          <p className="text-medium text-muted-foreground">
            {[profile.trading_name, profile.industry ? humanise(profile.industry) : null, location]
              .filter(Boolean)
              .join(' · ') || 'Your company profile on Podium'}
          </p>
          <p className="text-small text-muted-foreground">
            Profile status: {humanise(profile.status)}
          </p>
        </div>
        <Link href={ROUTES.brand.settings} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Edit profile
        </Link>
      </header>

      {profile.description ? (
        <section aria-labelledby="about-heading" className="space-y-3">
          <h2 id="about-heading" className="font-heading text-large font-semibold text-foreground">
            About
          </h2>
          <p className="whitespace-pre-line text-medium leading-relaxed text-muted-foreground">
            {profile.description}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="looking-for-heading" className="space-y-3">
        <h2 id="looking-for-heading" className="font-heading text-large font-semibold text-foreground">
          What you&apos;re looking for
        </h2>
        {profile.seeking.length > 0 || profile.target_sports.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {[...profile.seeking, ...profile.target_sports].map((item) => (
              <li
                key={item}
                className="rounded-full border border-border bg-card px-3 py-1 text-small text-foreground"
              >
                {humanise(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-medium text-muted-foreground">
            You have not told athletes what you are looking for yet. Add it in Settings so the
            right talent finds you.
          </p>
        )}
      </section>

      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="font-heading text-large font-semibold text-foreground">
          Company details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-small text-muted-foreground">Website</dt>
            <dd className="text-medium text-foreground">{profile.website_url ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">LinkedIn</dt>
            <dd className="truncate text-medium text-foreground">{profile.linkedin_url || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Headquarters</dt>
            <dd className="text-medium text-foreground">{location || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Target level</dt>
            <dd className="text-medium text-foreground">
              {profile.target_level ? humanise(profile.target_level) : 'Not set'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
