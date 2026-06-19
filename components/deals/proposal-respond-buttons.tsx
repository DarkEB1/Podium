'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  proposalId: string
}

export default function ProposalRespondButtons({ proposalId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(`/api/deals/proposals/${proposalId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Something went wrong')
        return
      }
      toast.success(action === 'accepted' ? 'Proposal accepted!' : 'Proposal declined.')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-3 pt-2 border-t">
      <Button onClick={() => respond('accepted')} disabled={loading !== null}>
        {loading === 'accepted' ? 'Accepting…' : 'Accept'}
      </Button>
      <Button variant="outline" onClick={() => respond('declined')} disabled={loading !== null}>
        {loading === 'declined' ? 'Declining…' : 'Decline'}
      </Button>
    </div>
  )
}
