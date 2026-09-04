'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { apiFetch, ApiAuthError } from '@/lib/api/fetch-json'
import { buttonVariants } from '@/components/ui/button'
import GuardianConsentRequestButton from '@/components/guardian/request-consent-button'
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
  const [guardianNeeded, setGuardianNeeded] = useState(false)
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

  if (guardianNeeded) {
    return (
      <div className="space-y-3">
        <p className="text-medium text-muted-foreground">
          Because you are under 18, a parent or guardian must consent before you can sign this
          contract.
        </p>
        <GuardianConsentRequestButton />
      </div>
    )
  }

  async function handleSign() {
    setLoading(true)
    try {
      // WS-SEC-05: apiFetch throws ApiAuthError if the session has expired
      // (a redirect to sign-in or a 401), so an expired session can never toast
      // "Contract signed" with nothing written.
      const res = await apiFetch(`/api/deals/contracts/${contractId}/sign`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        // 2.3 — an under-18 athlete is blocked until a guardian consents. Swap the
        // sign button for a guardian-consent request rather than a bare error.
        if (json.error?.code === 'GUARDIAN_CONSENT_REQUIRED') {
          setGuardianNeeded(true)
          return
        }
        toast.error(json.error?.message ?? 'Failed to sign contract')
        return
      }
      toast.success('Contract signed successfully')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiAuthError) {
        toast.error(err.message)
        return
      }
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
