'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  profileId: string
  profileType: 'athlete' | 'brand'
  currentStatus: string
}

export default function ApproveRejectButtons({ profileId, profileType, currentStatus }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, profile_type: profileType }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Action failed')
        return
      }
      toast.success(action === 'approve' ? 'Profile approved' : 'Profile rejected')
      setConfirming(null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (currentStatus === 'active') {
    return (
      <p className="text-sm text-muted-foreground">Profile is already active.</p>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {confirming === 'approve' ? 'Approve this profile?' : 'Reject this profile?'}
        </p>
        <Button
          size="sm"
          variant={confirming === 'approve' ? 'default' : 'destructive'}
          disabled={loading}
          onClick={() => handleAction(confirming)}
          aria-label={`Confirm ${confirming}`}
        >
          {loading ? 'Processing…' : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => setConfirming(null)}
          aria-label="Cancel"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        onClick={() => setConfirming('approve')}
        aria-label="Approve profile"
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setConfirming('reject')}
        aria-label="Reject profile"
      >
        Reject
      </Button>
    </div>
  )
}
