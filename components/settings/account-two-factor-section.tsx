'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Stage = 'idle' | 'confirm' | 'recovery' | 'disable'

/** Manage the caller's own TOTP two-factor authentication (spec §security). */
export default function AccountTwoFactorSection({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('idle')
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [token, setToken] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function startEnroll() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account/2fa/enroll', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as { secret?: string; otpauthUrl?: string; error?: { message?: string } }
      if (!res.ok || !json.secret) {
        toast.error(json.error?.message ?? 'Could not start setup.')
        return
      }
      setSecret(json.secret)
      setOtpauthUrl(json.otpauthUrl ?? '')
      setStage('confirm')
    } finally {
      setBusy(false)
    }
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account/2fa/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json().catch(() => ({}))) as { recoveryCodes?: string[]; error?: { message?: string } }
      if (!res.ok) {
        setError(json.error?.message ?? 'That code is not valid.')
        return
      }
      setRecoveryCodes(json.recoveryCodes ?? [])
      setStage('recovery')
    } finally {
      setBusy(false)
    }
  }

  // Turning 2FA OFF now costs a current code or a recovery code, exactly as
  // turning it on does. Without that, a stolen session could strip the second
  // factor in one request, which is the scenario 2FA exists for.
  async function disable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!res.ok) {
        setError(json.error?.message ?? 'That code is not valid.')
        return
      }
      toast.success('Two-factor authentication turned off')
      setStage('idle')
      setToken('')
      router.refresh()
    } catch {
      setError('Could not turn off 2FA. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Two-factor authentication</h2>

      {enabled && stage === 'idle' && (
        <div className="mt-3 space-y-3">
          <p className="text-medium text-muted-foreground">
            Two-factor authentication is on. You will be asked for a code when you sign in.
          </p>
          <button
            type="button"
            onClick={() => { setError(''); setToken(''); setStage('disable') }}
            disabled={busy}
            className={cn(buttonVariants({ variant: 'outline' }), busy && 'opacity-60')}
          >
            Turn off 2FA
          </button>
        </div>
      )}

      {stage === 'disable' && (
        <form onSubmit={disable} className="mt-4 space-y-4">
          <p className="text-medium text-muted-foreground">
            Enter a code from your authenticator app, or one of your recovery
            codes, to turn two-factor authentication off.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Authentication code"
            placeholder="123456"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <p role="alert" className="text-small text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !token} className={cn(buttonVariants({ variant: 'outline' }), (busy || !token) && 'opacity-60')}>
              {busy ? 'Turning off…' : 'Confirm and turn off'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('idle'); setToken(''); setError('') }}
              disabled={busy}
              className={cn(buttonVariants({ variant: 'ghost' }))}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!enabled && stage === 'idle' && (
        <div className="mt-3 space-y-3">
          <p className="text-medium text-muted-foreground">
            Add a second step at sign-in with any authenticator app.
          </p>
          <button type="button" onClick={startEnroll} disabled={busy} className={cn(buttonVariants(), busy && 'opacity-60')}>
            {busy ? 'Starting…' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <form onSubmit={activate} className="mt-4 space-y-4">
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
      )}

      {stage === 'recovery' && (
        <div className="mt-4 space-y-4">
          <p className="text-medium text-muted-foreground">
            Save these recovery codes somewhere safe. Each works once if you lose your authenticator.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted p-4 font-mono text-medium">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setStage('idle')
              router.refresh()
            }}
            className={cn(buttonVariants())}
          >
            Done
          </button>
        </div>
      )}
    </section>
  )
}
