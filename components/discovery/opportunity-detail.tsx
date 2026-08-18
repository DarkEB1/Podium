'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bookmark, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ROUTES } from '@/lib/routes'
import { getUrgency } from '@/lib/discovery/urgency'
import type { ScoredListing } from '@/lib/discovery/match'

import { MatchScore } from './match-score'
import { brandColor, brandInitials, payDisplay } from './brand-visual'
import { ConnectionRequestDialog } from './connection-request'

interface Props {
  listing: ScoredListing
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Coarse fit label for the match score, mirroring the approved mockup. */
function fitLabel(score: number): string {
  if (score >= 85) return 'Strong fit'
  if (score >= 70) return 'Good fit'
  return 'Fair fit'
}

/** A success-green tick used beside each match reason. */
function ReasonTick() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded-full bg-success"
    >
      <Check className="size-3 text-background" strokeWidth={2.5} />
    </span>
  )
}

/**
 * OpportunityDetail is the Live Board card-back (Task 7).
 *
 * A dark brand panel (monogram or logo, brand name, campaign line and the brand
 * about-text), the lg match score, the full list of match reasons, a terms row
 * and two actions: Save to the shortlist and Send request (the shared
 * connection-request composer).
 */
export function OpportunityDetail({ listing, open, onOpenChange }: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const brandName = listing.brand_name
  const heading = brandName ?? listing.title
  const pay = payDisplay(listing)
  const urgency = getUrgency(listing)
  const canSave = listing.brand_user_id !== null

  const contract = listing.contract_duration_months
    ? `${listing.contract_duration_months} month contract`
    : 'Flexible'
  const deadlineValue = urgency?.kind === 'closing' ? urgency.label : 'Open'

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <div className="space-y-5">
            {/* Dark brand panel */}
            <div className="rounded-xl bg-foreground p-5 text-background">
              <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-background/60">
                {fitLabel(listing.matchScore)}
              </p>
              <div className="flex items-start gap-3">
                {listing.brand_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- brand logos come from arbitrary hosts not declared in next.config images.remotePatterns
                  <img
                    src={listing.brand_logo_url}
                    alt=""
                    aria-hidden="true"
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: brandColor(heading) }}
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold text-white"
                  >
                    {brandInitials(heading)}
                  </span>
                )}
                <div className="min-w-0">
                  <DialogTitle className="text-large font-bold text-background">
                    {heading}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 font-mono text-small text-background/60">
                    {listing.title}
                  </DialogDescription>
                </div>
              </div>
              {listing.brand_description && (
                <p className="mt-4 text-medium leading-relaxed text-background/75">
                  {listing.brand_description}
                </p>
              )}
            </div>

            {/* Match score */}
            <div className="flex items-center gap-4">
              <MatchScore score={listing.matchScore} size="lg" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Match score
                </p>
                <p className="font-medium text-foreground">{fitLabel(listing.matchScore)}</p>
              </div>
            </div>

            {/* Why this ranks for you */}
            {listing.matchReasons.length > 0 && (
              <section>
                <h3 className="mb-3 font-mono text-small font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Why this ranks for you
                </h3>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {listing.matchReasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-medium font-medium text-foreground"
                    >
                      <ReasonTick />
                      {reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Terms */}
            <div className="flex overflow-hidden rounded-xl border border-border font-mono">
              <div className="flex-1 border-r border-border px-4 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Pay
                </p>
                <p className="text-medium font-semibold text-foreground">{pay.value}</p>
              </div>
              <div className="flex-1 border-r border-border px-4 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Contract
                </p>
                <p className="text-medium font-semibold text-foreground">{contract}</p>
              </div>
              <div className="flex-1 px-4 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Deadline
                </p>
                <p
                  className={
                    urgency?.kind === 'closing'
                      ? 'text-medium font-semibold text-warning'
                      : 'text-medium font-semibold text-foreground'
                  }
                >
                  {deadlineValue}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={save}
                disabled={!canSave || saving || saved}
              >
                <Bookmark className={saved ? 'fill-current' : undefined} />
                {saved ? 'Saved' : 'Save'}
              </Button>
              <Button type="button" className="flex-1" onClick={() => setComposerOpen(true)}>
                Send request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConnectionRequestDialog
        listing={listing}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        surface="opportunity_detail"
      />
    </>
  )
}
