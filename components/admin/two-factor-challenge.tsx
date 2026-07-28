'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** The recurring admin 2FA login challenge (2.4). */
export default function TwoFactorChallenge() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        setError(json.error?.message ?? 'That code is not valid.')
        setBusy(false)
        return
      }
      router.push('/admin/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-medium text-muted-foreground">
        Enter the 6-digit code from your authenticator app, or one of your recovery codes.
      </p>
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
        {busy ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  )
}
