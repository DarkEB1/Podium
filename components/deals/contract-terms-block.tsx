import { formatMajorAmount } from '@/lib/money'
import { formatDateRange } from '@/lib/dates'

/**
 * Task 16 — mirrors `termsString` in `lib/esign/finalize.ts` and
 * `review-and-sign-dialog.tsx`: `terms_snapshot` jsonb fields come back as
 * either a plain string or `{ text }`, and this is the read-only surface
 * (deal detail pages) that needs to render one.
 */
function termsString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    const t = (v as { text?: unknown }).text
    if (typeof t === 'string') return t.trim() || null
    return JSON.stringify(v)
  }
  return String(v)
}

interface ContractTermsBlockProps {
  terms: Record<string, unknown>
}

/**
 * Server-safe (no "use client") presentational panel — "This is what you're
 * signing" — rendered on the three deal detail pages alongside the contract
 * status, so a participant can read the pinned terms without opening the
 * sign dialog.
 */
export function ContractTermsBlock({ terms }: ContractTermsBlockProps) {
  const title = termsString(terms.title) ?? 'Sponsorship Agreement'
  const payAmount = Number(terms.pay_amount ?? 0)
  const payCurrency = termsString(terms.pay_currency) ?? 'GBP'
  const payType = termsString(terms.pay_type)
  const timeline = formatDateRange(termsString(terms.timeline_start), termsString(terms.timeline_end))
  const deliverables = termsString(terms.deliverables)
  const usageRights = termsString(terms.usage_rights)
  const additionalTerms = termsString(terms.additional_terms)

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h2 className="font-semibold">This is what you&apos;re signing</h2>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-4">
        <dt className="text-muted-foreground">Title</dt>
        <dd className="min-w-0 break-words font-medium">{title}</dd>

        <dt className="text-muted-foreground">Fee</dt>
        <dd className="min-w-0 break-words">
          {formatMajorAmount(payAmount, payCurrency)}
          {payType && <> · {payType.replace(/_/g, ' ')}</>}
        </dd>

        {timeline && (
          <>
            <dt className="text-muted-foreground">Timeline</dt>
            <dd className="min-w-0 break-words">{timeline}</dd>
          </>
        )}
        {deliverables && (
          <>
            <dt className="text-muted-foreground">Deliverables</dt>
            <dd className="min-w-0 break-words">{deliverables}</dd>
          </>
        )}
        {usageRights && (
          <>
            <dt className="text-muted-foreground">Usage rights</dt>
            <dd className="min-w-0 break-words">{usageRights}</dd>
          </>
        )}
        {additionalTerms && (
          <>
            <dt className="text-muted-foreground">Additional terms</dt>
            <dd className="min-w-0 break-words">{additionalTerms}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
