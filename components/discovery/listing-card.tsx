import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props { listing: JobListingRow }

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

export default function ListingCard({ listing }: Props) {
  const payLabel = listing.pay_type ? PAY_TYPE_LABEL[listing.pay_type] : null

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
      <div>
        <p className="font-semibold">{listing.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[listing.sport_required, listing.level_required?.replace('_', ' ')].filter(Boolean).join(' · ')}
        </p>
      </div>
      {listing.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {listing.location && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{listing.is_remote ? 'Remote' : listing.location}</span>
        )}
        {payLabel && listing.pay_amount && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {payLabel} · {listing.pay_currency} {listing.pay_amount.toLocaleString()}
          </span>
        )}
        {listing.contract_duration_months && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{listing.contract_duration_months}mo contract</span>
        )}
      </div>
    </div>
  )
}
