'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

type State = 'idle' | 'submitting' | 'sent' | 'error'

interface Props {
  className?: string
  label?: string
}

/**
 * Lets an under-18 athlete email their guardian a consent link (2.3). Shown at
 * the point of friction (a blocked signature) and reusable from settings. The
 * token never returns to this client; it only lives in the guardian's email.
 */
export default function GuardianConsentRequestButton({
  className,
  label = 'Send consent request to my guardian',
}: Props) {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function send() {
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/guardian-consent/request', { method: 'POST' })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        setError(json.error?.message ?? 'Could not send the request. Please try again.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setError('Could not send the request. Please try again.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="text-medium text-muted-foreground">
        We have emailed your guardian a consent link. Once they confirm, you can sign.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={send}
        disabled={state === 'submitting'}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          state === 'submitting' && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        {state === 'submitting' ? 'Sending…' : label}
      </button>
      {state === 'error' && <p className="text-medium text-destructive">{error}</p>}
    </div>
  )
}
