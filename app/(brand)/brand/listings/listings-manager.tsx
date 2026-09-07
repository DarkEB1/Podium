'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']
type ListingStatus = Database['public']['Enums']['listing_status']

/** Subset of the listing fields the manager UI needs. */
export type ManagedListing = Pick<
  JobListingRow,
  'id' | 'title' | 'type' | 'status' | 'sport_required'
>

const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  expired: 'Expired',
  filled: 'Closed',
}

interface Props {
  listings: ManagedListing[]
}

export default function ListingsManager({ listings }: Props) {
  const router = useRouter()
  // local copy so status updates reflect immediately without a full reload
  const [rows, setRows] = useState<ManagedListing[]>(listings)
  const [busyId, setBusyId] = useState<string | null>(null)
  // id of the listing awaiting a close confirmation, if any
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null)

  // WS-LISTING-02: after an action we call router.refresh(), which re-runs the
  // server component and hands down fresh `listings`. useState(listings) alone
  // never picks that up, so the optimistic row could silently disagree with the
  // server (the whole reason Pause/Close "worked" before while doing nothing).
  // Resync whenever the server's copy changes.
  useEffect(() => {
    setRows(listings)
  }, [listings])

  // WS-LISTING-02: status changes go to the dedicated /status route, which runs
  // updateListingStatus behind an explicit transition table. The old generic
  // PATCH stripped `status` and changed nothing while toasting success.
  async function patchStatus(id: string, status: ListingStatus, successMsg: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/discovery/listings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to update listing')
        return
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
      toast.success(successMsg)
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusyId(null)
      setConfirmCloseId(null)
    }
  }

  // WS-LISTING-01: publishing an offer had no control in the product at all —
  // the feed only ever showed seeded rows. Publish flips draft -> active through
  // the entitlement-gated publish route, then resyncs from the server.
  async function publish(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/discovery/listings/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to publish listing')
        return
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'active' } : r)))
      toast.success('Listing published')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  function duplicate(id: string) {
    // Route to the create page, which pre-fills the form from the source listing.
    router.push(`/brand/listings/new?from=${id}`)
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
      {rows.map((l) => {
        const isDraft = l.status === 'draft'
        const isPaused = l.status === 'paused'
        const isActive = l.status === 'active'
        const isClosed = l.status === 'filled' || l.status === 'expired'
        return (
          <li key={l.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{l.title}</p>
              <p className="text-small text-muted-foreground">
                {l.type.replace('_', ' ')} · {l.sport_required ?? 'Any sport'} ·{' '}
                <span data-slot="listing-status">{STATUS_LABEL[l.status]}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/brand/listings/${l.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Edit
              </Link>

              {isDraft && (
                <Button
                  size="sm"
                  disabled={busyId === l.id}
                  onClick={() => publish(l.id)}
                >
                  Publish
                </Button>
              )}

              {isPaused && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === l.id}
                  onClick={() => patchStatus(l.id, 'active', 'Listing resumed')}
                >
                  Resume
                </Button>
              )}

              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === l.id}
                  onClick={() => patchStatus(l.id, 'paused', 'Listing paused')}
                >
                  Pause
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => duplicate(l.id)}
              >
                Duplicate
              </Button>

              {!isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === l.id}
                  onClick={() => setConfirmCloseId(l.id)}
                >
                  Close
                </Button>
              )}

              {confirmCloseId === l.id && (
                <span className="flex items-center gap-2 text-small text-muted-foreground">
                  Close this listing?
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === l.id}
                    onClick={() => patchStatus(l.id, 'filled', 'Listing closed')}
                  >
                    Confirm close
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmCloseId(null)}>
                    Cancel
                  </Button>
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
