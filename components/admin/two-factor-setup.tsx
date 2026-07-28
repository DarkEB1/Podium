'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Stage = 'intro' | 'enrolling' | 'confirm' | 'recovery'

/** First-time admin 2FA enrollment (2.4): generate a secret, confirm a code, show recovery codes. */
export default function TwoFactorSetup() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('intro')
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [token, setToken] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function startEnrollment() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/2fa/enroll', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as {
        secret?: string
        otpauthUrl?: string
        error?: { message?: string }
      }
      if (!res.ok || !json.secret) {
        setError(json.error?.message ?? 'Could not start setup.')
        setStage('intro')
        return
      }
      setSecret(json.secret)
      setOtpauthUrl(json.otpauthUrl ?? '')
      setStage('confirm')
    } catch {
      setError('Something went wrong. Please try again.')
      setStage('intro')
    } finally {
      setBusy(false)
    }
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/2fa/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        recoveryCodes?: string[]
        error?: { message?: string }
      }
      if (!res.ok) {
        setError(json.error?.message ?? 'That code is not valid.')
        return
      }
      setRecoveryCodes(json.recoveryCodes ?? [])
      setStage('recovery')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'recovery') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-large font-semibold text-foreground">Save your recovery codes</h2>
          <p className="mt-2 text-medium text-muted-foreground">
            Store these somewhere safe. Each one works once if you lose your authenticator. They will
            not be shown again.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted p-4 font-mono text-medium">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            router.push('/admin/dashboard')
            router.refresh()
          }}
          className={cn(buttonVariants())}
        >
          I have saved them, continue
        </button>
      </div>
    )
  }

  if (stage === 'confirm') {
    return (
      <form onSubmit={activate} className="space-y-5">
        <div className="space-y-2">
          <h2 className="font-heading text-large font-semibold text-foreground">Add Podium to your authenticator</h2>
          <p className="text-medium text-muted-foreground">
            Scan the setup link with your authenticator app, or enter this key manually, then confirm
            the 6-digit code it shows.
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-muted p-4">
          <p className="text-small text-muted-foreground">Manual key</p>
          <p className="font-mono text-medium break-all text-foreground">{secret}</p>
          {otpauthUrl && (
            <>
              <p className="mt-2 text-small text-muted-foreground">Setup link</p>
              <p className="font-mono text-small break-all text-foreground">{otpauthUrl}</p>
            </>
          )}
        </div>
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-label="Authentication code"
        />
        {error && <p className="text-medium text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !token} className={cn(buttonVariants(), (busy || !token) && 'opacity-60')}>
          {busy ? 'Confirming…' : 'Confirm and enable'}
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-medium text-muted-foreground">
        Admin access requires two-factor authentication. Set it up with any authenticator app
        (Google Authenticator, 1Password, Authy) to continue.
      </p>
      {error && <p className="text-medium text-destructive">{error}</p>}
      <button type="button" onClick={startEnrollment} disabled={busy} className={cn(buttonVariants(), busy && 'opacity-60')}>
        {busy ? 'Starting…' : 'Set up two-factor authentication'}
      </button>
    </div>
  )
}
