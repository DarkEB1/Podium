import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAllListings } from '@/lib/supabase/admin'
import StatusBadge from '@/components/admin/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ListingStatus = Database['public']['Enums']['listing_status']
const STATUSES: ListingStatus[] = ['draft', 'active', 'paused', 'expired', 'filled']

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const { status: statusFilter } = await searchParams

  const adminClient = createAdminClient()
  let listings = await getAllListings(adminClient)

  if (statusFilter && STATUSES.includes(statusFilter as ListingStatus)) {
    listings = listings.filter((l) => l.status === statusFilter)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-muted-foreground">{listings.length} job listings</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/listings"
          className={cn(buttonVariants({ variant: !statusFilter ? 'default' : 'outline', size: 'sm' }))}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/listings?status=${s}`}
            className={cn(buttonVariants({ variant: statusFilter === s ? 'default' : 'outline', size: 'sm' }))}
          >
            {s}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No listings found.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {listings.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{l.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[l.type.replace(/_/g, ' '), l.sport_required, l.location]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(l.created_at).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
