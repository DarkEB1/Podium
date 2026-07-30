import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getBrandProfileById } from '@/lib/supabase/admin'
import StatusBadge from '@/components/admin/status-badge'
import ApproveRejectButtons from '@/components/admin/approve-reject-buttons'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const adminClient = createAdminClient()
  const brand = await getBrandProfileById(adminClient, id)
  if (!brand) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/brands" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Brands
        </Link>
        <StatusBadge status={brand.status} />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{brand.company_name ?? 'Unnamed brand'}</h1>
        {brand.trading_name && <p className="text-muted-foreground">Trading as: {brand.trading_name}</p>}
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Approval</h2>
        <ApproveRejectButtons profileId={brand.id} profileType="brand" currentStatus={brand.status} />
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Company details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Company name</dt>
          <dd>{brand.company_name ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Trading name</dt>
          <dd>{brand.trading_name ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Industry</dt>
          <dd>{brand.industry?.replace(/_/g, ' ') ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{[brand.headquarters_city, brand.headquarters_country].filter(Boolean).join(', ') || 'Not set'}</dd>
          <dt className="text-muted-foreground">Website</dt>
          <dd>
            {brand.website_url
              ? <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="underline truncate">{brand.website_url}</a>
              : 'Not set'}
          </dd>
          <dt className="text-muted-foreground">LinkedIn</dt>
          <dd>
            {brand.linkedin_url
              ? <a href={brand.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">View</a>
              : 'Not set'}
          </dd>
          <dt className="text-muted-foreground">Reg. number</dt>
          <dd>{brand.company_registration_number ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">VAT number</dt>
          <dd>{brand.vat_number ?? 'Not set'}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(brand.created_at).toLocaleDateString()}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{new Date(brand.updated_at).toLocaleDateString()}</dd>
        </dl>
      </div>

      {brand.description && (
        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">About</h2>
          <p className="text-sm">{brand.description}</p>
        </div>
      )}

      {brand.seeking && brand.seeking.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Seeking</h2>
          <div className="flex flex-wrap gap-2">
            {brand.seeking.map((s) => (
              <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
