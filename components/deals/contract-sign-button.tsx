'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import GuardianConsentRequestButton from '@/components/guardian/request-consent-button'
import { ReviewAndSignDialog } from '@/components/deals/review-and-sign-dialog'
import type { Database } from '@/types/database'

type ContractStatus = Database['public']['Enums']['contract_status']

interface ContractSignButtonProps {
  contractId: string
  status: ContractStatus
  isBrand: boolean
  alreadySigned: boolean
  /**
   * `terms_snapshot` from the contract — rendered read-only in the dialog.
   * Optional for now: the deal pages don't thread it through yet (Task 16
   * wires it up); an absent snapshot renders an emptier — but still
   * functional — term sheet rather than a type error.
   */
  terms?: Record<string, unknown>
}

export default function ContractSignButton({
  contractId,
  status,
  isBrand,
  alreadySigned,
  terms = {},
}: ContractSignButtonProps) {
  const [open, setOpen] = useState(false)
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

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn(buttonVariants())}>
        Review & Sign
      </button>
      <ReviewAndSignDialog
        open={open}
        contractId={contractId}
        terms={terms}
        onClose={() => setOpen(false)}
        onSigned={() => {
          setOpen(false)
          router.refresh()
        }}
        // 2.3 — an under-18 athlete is blocked until a guardian consents. Swap
        // the sign button for a guardian-consent request rather than a bare
        // error toast.
        onGuardianRequired={() => {
          setOpen(false)
          setGuardianNeeded(true)
        }}
      />
    </>
  )
}
