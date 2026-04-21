'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

interface Props { athlete: AthleteRow }

export default function AthleteCard({ athlete }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (!message.trim()) { toast.error('Please write a message'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/discovery/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: athlete.user_id, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to send request')
        return
      }
      toast.success('Connection request sent!')
      setOpen(false)
      setMessage('')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
          {(athlete.display_name ?? '?')[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{athlete.display_name ?? 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">
            {[athlete.primary_sport, athlete.level?.replace('_', ' ')].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground">
            {[athlete.home_city, athlete.home_country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      {athlete.seeking.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {athlete.seeking.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          Connect
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="Introduce your brand and what you're looking for…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleConnect} disabled={loading}>
              {loading ? 'Sending…' : 'Send request'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); setMessage('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
