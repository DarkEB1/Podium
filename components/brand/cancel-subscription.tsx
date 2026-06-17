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
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 space-y-4">
      <p className="text-medium font-medium text-destructive">
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
