'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Enable/disable browser push notifications (spec §7). */
export default function PushSection() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(ok)
    if (!ok) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    if (!vapidKey) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Notifications permission was not granted.')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/account/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('failed')
      setSubscribed(true)
      toast.success('Push notifications enabled')
    } catch {
      toast.error('Could not enable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/account/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Push notifications disabled')
    } catch {
      toast.error('Could not disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Push notifications</h2>
      {!vapidKey || !supported ? (
        <p className="mt-3 text-medium text-muted-foreground">
          Push notifications are not available in this browser or environment.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-medium text-muted-foreground">
            Get browser notifications for new messages, deals and connection requests.
          </p>
          <button
            type="button"
            onClick={subscribed ? disable : enable}
            disabled={busy}
            className={cn(buttonVariants({ variant: subscribed ? 'outline' : 'default' }), busy && 'opacity-60')}
          >
            {busy ? 'Working…' : subscribed ? 'Disable push' : 'Enable push'}
          </button>
        </div>
      )}
    </section>
  )
}
