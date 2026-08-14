import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAllBrandProfiles } from '@/lib/supabase/admin'
import StatusBadge from '@/components/admin/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { AccentHeading } from '@/components/ui/accent-heading'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandStatus = Database['public']['Enums']['brand_status']
const STATUSES: BrandStatus[] = ['pending_approval', 'active', 'suspended', 'rejected']

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const { status: statusFilter, q } = await searchParams

  const adminClient = createAdminClient()
  let brands = await getAllBrandProfiles(adminClient)

  if (statusFilter && STATUSES.includes(statusFilter as BrandStatus)) {
    brands = brands.filter((b) => b.status === statusFilter)
  }
  if (q) {
    const query = q.toLowerCase()
    brands = brands.filter(
      (b) =>
        b.company_name?.toLowerCase().includes(query) ||
        b.trading_name?.toLowerCase().includes(query)
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Brands</p>
        <AccentHeading as="h1" className="text-display">Brands</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">{brands.length} profiles</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/brands"
          className={cn(buttonVariants({ variant: !statusFilter ? 'default' : 'outline', size: 'sm' }))}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/brands?status=${s}`}
            className={cn(buttonVariants({ variant: statusFilter === s ? 'default' : 'outline', size: 'sm' }))}
          >
            {s.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      {brands.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No brands found.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/brands/${b.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.company_name ?? 'Unnamed brand'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[b.trading_name, b.industry?.replace(/_/g, ' '), b.headquarters_country]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <StatusBadge status={b.status} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
