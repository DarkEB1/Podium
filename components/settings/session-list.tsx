'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface SessionItem {
  id: string
  deviceLabel: string | null
  ip: string | null
  lastActiveAt: string
}

export default function SessionList({ sessions }: { sessions: SessionItem[] }) {
  const [items, setItems] = useState(sessions)
  const [pending, setPending] = useState<string | null>(null)

  async function revoke(id: string) {
    setPending(id)
    try {
      const res = await fetch(`/api/account/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      setItems((prev) => prev.filter((s) => s.id !== id))
      toast.success('Session signed out')
    } catch {
      toast.error('Could not sign out that session. Please try again.')
    } finally {
      setPending(null)
    }
  }

  if (items.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-large font-semibold text-foreground">Active sessions</h2>
        <p className="mt-3 text-medium text-muted-foreground">No active sessions on record.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-heading text-large font-semibold text-foreground">Active sessions</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-medium text-foreground">{s.deviceLabel ?? 'Unknown device'}</p>
              <p className="text-small text-muted-foreground">
                {s.ip ? `${s.ip} · ` : ''}
                Last active {new Date(s.lastActiveAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revoke(s.id)}
              disabled={pending === s.id}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), pending === s.id && 'opacity-60')}
            >
              {pending === s.id ? 'Signing out…' : 'Sign out'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
