'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface ProviderItem {
  provider: string
  label: string
  configured: boolean
  connected: boolean
}

/** Connect / disconnect social accounts via OAuth (spec §6). */
export default function SocialSection({ providers }: { providers: ProviderItem[] }) {
  const [items, setItems] = useState(providers)
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(provider: string) {
    setBusy(provider)
    try {
      const res = await fetch(`/api/social/${provider}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      setItems((prev) => prev.map((p) => (p.provider === provider ? { ...p, connected: false } : p)))
      toast.success('Disconnected')
    } catch {
      toast.error('Could not disconnect. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Social accounts</h2>
      <p className="mt-3 text-medium text-muted-foreground">
        Connect your social accounts to verify your handles.
      </p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {items.map((p) => (
          <li key={p.provider} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-medium text-foreground">{p.label}</span>
            {!p.configured ? (
              <span className="text-small text-muted-foreground">Coming soon</span>
            ) : p.connected ? (
              <button
                type="button"
                onClick={() => remove(p.provider)}
                disabled={busy === p.provider}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), busy === p.provider && 'opacity-60')}
              >
                Disconnect
              </button>
            ) : (
              <a href={`/api/social/${p.provider}/connect`} className={cn(buttonVariants({ size: 'sm' }))}>
                Connect
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
