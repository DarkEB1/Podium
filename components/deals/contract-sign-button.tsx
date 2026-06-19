'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { Database } from '@/types/database'

type ContractStatus = Database['public']['Enums']['contract_status']

interface ContractSignButtonProps {
  contractId: string
  status: ContractStatus
  isBrand: boolean
  alreadySigned: boolean
}

export default function ContractSignButton({
  contractId,
  status,
  isBrand,
  alreadySigned,
}: ContractSignButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (status === 'fully_signed' || status === 'terminated') return null
  if (alreadySigned) {
    return (
      <p className="text-sm text-muted-foreground">
        You have signed. Waiting for the other party.
      </p>
    )
  }

  const needsMySignature =
    (isBrand && (status === 'draft' || status === 'pending_brand_signature')) ||
    (!isBrand && (status === 'draft' || status === 'pending_athlete_signature'))

  if (!needsMySignature) return null

  async function handleSign() {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/contracts/${contractId}/sign`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error?.message ?? 'Failed to sign contract')
        return
      }
      toast.success('Contract signed successfully')
      router.refresh()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSign}
      disabled={loading}
      className={cn(buttonVariants(), loading && 'opacity-60 cursor-not-allowed')}
    >
      {loading ? 'Signing…' : 'Sign Contract'}
    </button>
  )
}
