'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bookmark, Check, X } from 'lucide-react'

import { ROUTES } from '@/lib/routes'
import { getUrgency } from '@/lib/discovery/urgency'
import type { ScoredListing } from '@/lib/discovery/match'

import { MatchScore } from './match-score'
import { brandColor, brandInitials, payDisplay } from './brand-visual'
import { OpportunityDetail } from './opportunity-detail'

interface Props {
  listing: ScoredListing
}

/**
 * OpportunityCard is the Live Board feed card (Task 7).
 *
 * The match score sits top-left, an urgency chip top-right, then the brand
 * lockup, the campaign title, the single strongest match reason, a mono meta
 * row (pay and deadline) and Save + Skip affordances. Clicking the card body
 * opens the card-back detail; the action buttons stop that from firing.
 */
export function OpportunityCard({ listing }: Props) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const brandName = listing.brand_name
  const pay = payDisplay(listing)
  const urgency = getUrgency(listing)
  const strongestReason = listing.matchReasons[0]
  const canSave = listing.brand_user_id !== null

  const deadlineText =
    urgency?.kind === 'closing' ? urgency.label : urgency?.kind === 'new' ? 'New' : 'Open'

  if (dismissed) return null

  async function save() {
    if (!listing.brand_user_id || saved) return
    setSaving(true)
    try {
      const res = await fetch(ROUTES.api.discovery.shortlist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: listing.brand_user_id }),
      })
      // 409 ALREADY_SHORTLISTED is a benign no-op (the brand is already saved).
      if (!res.ok && res.status !== 409) throw new Error('request failed')
      setSaved(true)
      toast.success('Saved to your shortlist')
    } catch {
      toast.error('Could not save that campaign. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openDetail() {
    setDetailOpen(true)
  }

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        aria-label={`${brandName ? `${brandName}: ` : ''}${listing.title}. Open details.`}
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openDetail()
          }
        }}
        className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* Score + urgency */}
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <MatchScore score={listing.matchScore} size="sm" />
          {urgency ? (
            <span
              className={
                urgency.kind === 'closing'
                  ? 'rounded-md bg-warning/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-warning'
                  : 'rounded-md bg-lime-tint-2 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-lime-foreground'
              }
            >
              {urgency.label}
            </span>
          ) : null}
        </div>

        {/* Brand lockup */}
        {brandName ? (
          <div className="mb-2.5 flex items-center gap-2.5">
            {listing.brand_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- brand logos come from arbitrary hosts not declared in next.config images.remotePatterns
              <img
                src={listing.brand_logo_url}
                alt=""
                aria-hidden="true"
                className="size-8 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                style={{ backgroundColor: brandColor(brandName) }}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
              >
                {brandInitials(brandName)}
              </span>
            )}
            <span className="min-w-0 truncate font-mono text-small font-semibold uppercase tracking-wide text-muted-foreground">
              {brandName}
            </span>
          </div>
        ) : null}

        {/* Title */}
        <h3 className="mb-2.5 text-medium font-bold leading-snug text-foreground">
          {listing.title}
        </h3>

        {/* Strongest reason */}
        {strongestReason ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-small font-medium text-foreground">
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center rounded-full bg-success"
            >
              <Check className="size-2.5 text-background" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 truncate">{strongestReason}</span>
          </div>
        ) : null}

        {/* Mono meta row */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 font-mono text-small">
          <span className="font-semibold text-foreground">{pay.value}</span>
          <span className="uppercase tracking-[0.02em] text-muted-foreground">{deadlineText}</span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!canSave || saving || saved}
            onClick={(e) => {
              e.stopPropagation()
              void save()
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-small font-semibold text-foreground transition hover:border-foreground hover:bg-lime-tint-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card"
          >
            <Bookmark className={saved ? 'size-4 fill-current' : 'size-4'} />
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDismissed(true)
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-small font-semibold text-muted-foreground transition hover:border-foreground"
          >
            <X className="size-4" />
            Skip
          </button>
        </div>
      </article>

      <OpportunityDetail listing={listing} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  )
}
