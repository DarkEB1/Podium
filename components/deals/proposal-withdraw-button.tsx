'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  proposalId: string
}

export default function ProposalWithdrawButton({ proposalId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function withdraw() {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/proposals/${proposalId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to withdraw proposal')
        return
      }
      toast.success('Proposal withdrawn.')
      router.push('/brand/deals')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pt-2 border-t">
      <Button variant="outline" onClick={withdraw} disabled={loading}>
        {loading ? 'Withdrawing…' : 'Withdraw proposal'}
      </Button>
    </div>
  )
}
