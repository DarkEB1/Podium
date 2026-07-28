'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const LABEL: Record<string, string> = {
  pending: 'Your verification request is in review.',
  approved: 'Your account is verified.',
  rejected: 'Your last verification request was not approved. You can request again.',
}

/** Request a verification badge (spec §6A). */
export default function VerificationSection({ status }: { status: string | null }) {
  const [current, setCurrent] = useState<string | null>(status)
  const [busy, setBusy] = useState(false)

  async function request() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/verification', { method: 'POST' })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(json.error?.message ?? 'failed')
      }
      setCurrent('pending')
      toast.success('Verification requested. Our team will review it shortly.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not request verification.')
    } finally {
      setBusy(false)
    }
  }

  const canRequest = current !== 'pending' && current !== 'approved'

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Verification</h2>
      {current && <p className="mt-3 text-medium text-foreground">{LABEL[current] ?? current}</p>}
      {!current && (
        <p className="mt-3 text-medium text-muted-foreground">
          Verified accounts get a badge that helps partners trust you.
        </p>
      )}
      {canRequest && (
        <button type="button" onClick={request} disabled={busy} className={cn(buttonVariants(), 'mt-4', busy && 'opacity-60')}>
          {busy ? 'Requesting…' : 'Request verification'}
        </button>
      )}
    </section>
  )
}
