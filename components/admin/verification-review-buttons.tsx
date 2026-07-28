'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/** Approve/reject controls for one verification request in the admin queue. */
export default function VerificationReviewButtons({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function review(action: 'approve' | 'reject') {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/verification/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success(action === 'approve' ? 'Verified' : 'Rejected')
      router.refresh()
    } catch {
      toast.error('Could not update that request. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => review('approve')} disabled={busy} className={cn(buttonVariants({ size: 'sm' }), busy && 'opacity-60')}>
        Approve
      </button>
      <button type="button" onClick={() => review('reject')} disabled={busy} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), busy && 'opacity-60')}>
        Reject
      </button>
    </div>
  )
}
