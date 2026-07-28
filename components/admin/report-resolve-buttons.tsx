'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/** Resolve/dismiss controls for one report in the trust queue. */
export default function ReportResolveButtons({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function set(status: 'resolved' | 'dismissed') {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success(status === 'resolved' ? 'Resolved' : 'Dismissed')
      router.refresh()
    } catch {
      toast.error('Could not update that report. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => set('resolved')} disabled={busy} className={cn(buttonVariants({ size: 'sm' }), busy && 'opacity-60')}>
        Resolve
      </button>
      <button type="button" onClick={() => set('dismissed')} disabled={busy} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), busy && 'opacity-60')}>
        Dismiss
      </button>
    </div>
  )
}
