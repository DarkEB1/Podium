'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function CancelSubscription() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/subscriptions/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to cancel'); return }
      toast.success('Subscription will cancel at the end of the billing period.')
      setConfirming(false)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <Button variant="destructive" onClick={() => setConfirming(true)}>
        Cancel subscription
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 space-y-3">
      <p className="text-sm font-medium text-red-800 dark:text-red-200">
        Are you sure? You will lose access to brand features at the end of the billing period.
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
          {loading ? 'Cancelling…' : 'Yes, cancel my subscription'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Keep subscription
        </Button>
      </div>
    </div>
  )
}
