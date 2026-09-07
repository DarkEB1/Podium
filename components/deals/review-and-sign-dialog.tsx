'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch, ApiAuthError } from '@/lib/api/fetch-json'
import { formatMajorAmount } from '@/lib/money'
import { formatDateRange } from '@/lib/dates'
import { termsString } from '@/lib/esign/terms'

interface ReviewAndSignDialogProps {
  open: boolean
  contractId: string
  terms: Record<string, unknown>
  onSigned: (contract: unknown) => void
  onClose: () => void
  onGuardianRequired?: () => void
}

const CONSENT_LABEL =
  'I agree that this is my electronic signature and I intend to be legally bound by this contract.'

/**
 * The embedded "Review & Sign" dialog (Task 14) — replaces the old
 * click-to-sign button, which POSTed an empty body with no read step, no
 * typed name, and no consent capture. Renders the pinned `terms_snapshot`,
 * collects a typed name + required consent + optional drawn signature, and
 * POSTs the sign payload the route (Task 13) now expects.
 */
export function ReviewAndSignDialog({
  open,
  contractId,
  terms,
  onSigned,
  onClose,
  onGuardianRequired,
}: ReviewAndSignDialogProps) {
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  const title = termsString(terms.title) ?? 'Sponsorship Agreement'
  const payAmount = Number(terms.pay_amount ?? 0)
  const payCurrency = typeof terms.pay_currency === 'string' ? terms.pay_currency : 'GBP'
  const payType = typeof terms.pay_type === 'string' ? terms.pay_type.replace(/_/g, ' ') : ''
  const timeline = formatDateRange(termsString(terms.timeline_start), termsString(terms.timeline_end))
  const deliverables = termsString(terms.deliverables)
  const usageRights = termsString(terms.usage_rights)
  const additionalTerms = termsString(terms.additional_terms)

  function reset() {
    setName('')
    setConsent(false)
    setSubmitting(false)
    clearSignature()
  }

  function drawContext() {
    const canvas = canvasRef.current
    if (!canvas || typeof canvas.getContext !== 'function') return null
    // jsdom (used in tests) doesn't implement a real 2D context and logs a
    // "Not implemented" error rather than returning null — guard so an
    // unsupported canvas can never break the surrounding submit/reset flow.
    try {
      return canvas.getContext('2d')
    } catch {
      return null
    }
  }

  function startDraw(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = drawContext()
    if (!canvas || !ctx) return
    drawingRef.current = true
    hasDrawnRef.current = true
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  function draw(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = drawContext()
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  function endDraw() {
    drawingRef.current = false
  }

  function clearSignature() {
    hasDrawnRef.current = false
    const canvas = canvasRef.current
    const ctx = drawContext()
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  async function handleSubmit() {
    if (!name.trim() || !consent || submitting) return
    setSubmitting(true)

    let signatureImage: string | null = null
    const canvas = canvasRef.current
    // The drawn signature is optional — jsdom (and some browsers) don't
    // implement `toDataURL`, so a missing/throwing canvas must never block
    // the typed-name submit path.
    if (hasDrawnRef.current && canvas && typeof canvas.toDataURL === 'function') {
      try {
        signatureImage = canvas.toDataURL('image/png')
      } catch {
        signatureImage = null
      }
    }

    try {
      const res = await apiFetch(`/api/deals/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typedName: name.trim(), consent, signatureImage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The guardian panel IS the UX for this error — a generic error toast
        // on top of it is noise, so only fire the toast for every other code.
        if (data?.error?.code === 'GUARDIAN_CONSENT_REQUIRED') {
          onGuardianRequired?.()
        } else {
          toast.error(data?.error?.message ?? 'Failed to sign contract')
        }
        return
      }
      toast.success('Contract signed successfully')
      reset()
      onSigned(data)
    } catch (err) {
      if (err instanceof ApiAuthError) {
        toast.error(err.message)
        return
      }
      toast.error('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review &amp; Sign</DialogTitle>
          <DialogDescription>
            Read the terms below, then type your name and confirm your consent to sign.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <TermRow label="Title" value={title} />
          <TermRow label="Pay" value={`${formatMajorAmount(payAmount, payCurrency)} · ${payType}`} />
          {timeline && <TermRow label="Timeline" value={timeline} />}
          {deliverables && <TermRow label="Deliverables" value={deliverables} />}
          {usageRights && <TermRow label="Usage rights" value={usageRights} />}
          {additionalTerms && <TermRow label="Additional terms" value={additionalTerms} />}
        </dl>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signer-name">Full name</Label>
            <Input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your full legal name"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signer-signature-pad">Signature (optional)</Label>
            <canvas
              id="signer-signature-pad"
              ref={canvasRef}
              width={400}
              height={120}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="w-full touch-none rounded-xl border border-input bg-card"
            />
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <Label htmlFor="consent" className="font-normal">
              {CONSENT_LABEL}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !consent || submitting}
          >
            {submitting ? 'Signing…' : 'Sign Contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  )
}
