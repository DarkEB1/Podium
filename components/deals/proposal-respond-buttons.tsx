'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ProposalForm from '@/components/brand/proposal-form'

interface Props {
  proposalId: string
}

export default function ProposalRespondButtons({ proposalId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)
  // WS-DEAL-01: the deal detail page only offered Accept/Decline, so a
  // recipient could never negotiate. Counter opens the same composer as chat.
  const [countering, setCountering] = useState(false)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(`/api/deals/proposals/${proposalId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
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
    <div className="flex flex-wrap gap-3 pt-2 border-t">
      <Button onClick={() => respond('accepted')} disabled={loading !== null}>
        {loading === 'accepted' ? 'Accepting…' : 'Accept'}
      </Button>
      <Button variant="outline" onClick={() => setCountering(true)} disabled={loading !== null}>
        Counter
      </Button>
      <Button variant="outline" onClick={() => respond('declined')} disabled={loading !== null}>
        {loading === 'declined' ? 'Declining…' : 'Decline'}
      </Button>

      <Dialog open={countering} onOpenChange={setCountering}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send a counter-offer</DialogTitle>
            <DialogDescription>
              Propose different terms. Your counter supersedes the current proposal.
            </DialogDescription>
          </DialogHeader>
          <ProposalForm
            parentProposalId={proposalId}
            onSent={() => {
              setCountering(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
