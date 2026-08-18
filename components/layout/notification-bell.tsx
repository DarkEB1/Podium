'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type NotificationRow = Database['public']['Tables']['notification_logs']['Row']

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // /api/notifications answers 401 (an expired session in another tab is
    // enough) and 500 with an `{ error }` OBJECT. Storing that made the next
    // render call .filter on a non-array, which threw and dropped every page
    // rendering the bell into its route error boundary. A failed fetch leaves
    // the list empty: the bell is ambient, never worth taking a page down for.
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        // as NotificationRow[]: the array shape is confirmed at runtime above,
        // but the row type cannot be proven from an untyped JSON body.
        if (Array.isArray(data)) setNotifications(data as NotificationRow[])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unread = notifications.filter((n) => !n.read_at)

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-4" />
        {unread.length > 0 && (
          <span
            role="status"
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-card shadow-lg">
          <div className="border-b px-4 py-2 text-sm font-semibold">Notifications</div>
          {notifications.length === 0 ? (
            // DASH6: a real empty state, not a bare line. Echoes the shared
            // EmptyState language (soft primary disc holding a Lucide icon +
            // supporting copy) at panel scale, so the bell says what will land
            // here rather than reading as an error.
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <div
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <BellOff className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                You&apos;ll hear here when brands message you or send connection requests.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y">
              {notifications.map((n) => (
                <li key={n.id} className={`px-4 py-3 ${!n.read_at ? 'bg-muted/40' : ''}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
