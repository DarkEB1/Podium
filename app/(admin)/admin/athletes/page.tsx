import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAllAthleteProfiles } from '@/lib/supabase/admin'
import StatusBadge from '@/components/admin/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { AccentHeading } from '@/components/ui/accent-heading'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ProfileStatus = Database['public']['Enums']['profile_status']
const STATUSES: ProfileStatus[] = ['pending_review', 'active', 'draft', 'deactivated']

export default async function AdminAthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const { status: statusFilter, q } = await searchParams

  const adminClient = createAdminClient()
  let athletes = await getAllAthleteProfiles(adminClient)

  if (statusFilter && STATUSES.includes(statusFilter as ProfileStatus)) {
    athletes = athletes.filter((a) => a.status === statusFilter)
  }
  if (q) {
    const query = q.toLowerCase()
    athletes = athletes.filter(
      (a) =>
        a.display_name?.toLowerCase().includes(query) ||
        a.full_legal_name?.toLowerCase().includes(query) ||
        a.primary_sport?.toLowerCase().includes(query)
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Athletes</p>
        <AccentHeading as="h1" className="text-display">Athletes</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">{athletes.length} profiles</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/athletes"
          className={cn(buttonVariants({ variant: !statusFilter ? 'default' : 'outline', size: 'sm' }))}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/athletes?status=${s}`}
            className={cn(buttonVariants({ variant: statusFilter === s ? 'default' : 'outline', size: 'sm' }))}
          >
            {s.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      {athletes.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No athletes found.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {athletes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/athletes/${a.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.display_name ?? a.full_legal_name ?? 'Unnamed'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.primary_sport, a.level?.replace(/_/g, ' '), a.home_country]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <StatusBadge status={a.status} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
