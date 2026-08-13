import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAthleteProfileById } from '@/lib/supabase/admin'
import StatusBadge from '@/components/admin/status-badge'
import ApproveRejectButtons from '@/components/admin/approve-reject-buttons'
import { buttonVariants } from '@/components/ui/button'
import { AccentHeading } from '@/components/ui/accent-heading'
import { cn } from '@/lib/utils'

export default async function AdminAthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const adminClient = createAdminClient()
  const athlete = await getAthleteProfileById(adminClient, id)
  if (!athlete) notFound()

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-12 md:px-8">
      <div className="flex items-center justify-between">
        <Link href="/admin/athletes" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Athletes
        </Link>
        <StatusBadge status={athlete.status} />
      </div>

      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Athlete</p>
        <AccentHeading as="h1" className="text-display">{athlete.display_name ?? athlete.full_legal_name ?? 'Unnamed athlete'}</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">
          {[athlete.primary_sport, athlete.level?.replace(/_/g, ' '), athlete.home_city, athlete.home_country]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Approval</h2>
        <ApproveRejectButtons profileId={athlete.id} profileType="athlete" currentStatus={athlete.status} />
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Profile details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Full legal name</dt>
          <dd>{athlete.full_legal_name ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Display name</dt>
          <dd>{athlete.display_name ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Sport</dt>
          <dd>{athlete.primary_sport ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Level</dt>
          <dd>{athlete.level?.replace(/_/g, ' ') ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{[athlete.home_city, athlete.home_country].filter(Boolean).join(', ') || 'Not set'}</dd>
          <dt className="text-muted-foreground">Has agent</dt>
          <dd>{athlete.has_agent ? 'Yes' : 'No'}</dd>
          <dt className="text-muted-foreground">Under 18</dt>
          <dd>{athlete.is_under_18 ? 'Yes' : 'No'}</dd>
          <dt className="text-muted-foreground">Date of birth</dt>
          <dd>{athlete.date_of_birth ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Profile photo</dt>
          <dd>{athlete.profile_photo_url ? <a href={athlete.profile_photo_url} target="_blank" rel="noopener noreferrer" className="underline">View</a> : 'Not set'}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(athlete.created_at).toLocaleDateString()}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{new Date(athlete.updated_at).toLocaleDateString()}</dd>
        </dl>
      </div>

      {athlete.notable_achievements && (
        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notable achievements</h2>
          <p className="text-sm">{athlete.notable_achievements}</p>
        </div>
      )}

      {athlete.seeking && athlete.seeking.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Seeking</h2>
          <div className="flex flex-wrap gap-2">
            {athlete.seeking.map((s) => (
              <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
