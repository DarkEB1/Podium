'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  token: string
  athleteName: string
}

type State = 'idle' | 'submitting' | 'done' | 'error'

/**
 * The guardian's confirm action (2.3). Consent is only recorded on this explicit
 * POST, never by loading the page, so following the emailed link cannot by
 * itself consent on the guardian's behalf.
 */
export default function GuardianConsentAccept({ token, athleteName }: Props) {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function accept() {
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/guardian-consent/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        setError(json.error?.message ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setError('Something went wrong. Please try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="rounded-lg bg-muted p-4 text-medium text-foreground">
        Thank you. Your consent has been recorded. {athleteName} can now sign agreements and
        receive payments on Podium.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={accept}
        disabled={state === 'submitting'}
        className={cn(buttonVariants(), state === 'submitting' && 'opacity-60 cursor-not-allowed')}
      >
        {state === 'submitting' ? 'Recording…' : `I consent for ${athleteName}`}
      </button>
      {state === 'error' && <p className="text-medium text-destructive">{error}</p>}
    </div>
  )
}
