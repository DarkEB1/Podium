'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type SelectableRole = Exclude<Database['public']['Enums']['user_role'], 'admin'>

const ROLES: { id: SelectableRole; title: string; description: string; badge: string }[] = [
  {
    id: 'athlete',
    title: 'Athlete',
    description: 'List yourself, get discovered by brands and agents. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Find sponsors for your team or club. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'brand',
    title: 'Brand / Sponsor',
    description: 'Search athletes and teams, send connection requests. Subscription required.',
    badge: 'Subscription',
  },
  {
    id: 'agent',
    title: 'Agent',
    description: 'Represent athletes and teams, broker deals. Always free.',
    badge: 'Free forever',
  },
]

const ROLE_ONBOARDING: Record<SelectableRole, string> = {
  athlete: '/athlete/onboarding',
  team: '/team/onboarding',
  brand: '/brand/onboarding',
  agent: '/agent/onboarding',
}

export default function RoleSelectForm() {
  const router = useRouter()
  const [selected, setSelected] = useState<SelectableRole | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to set role')
        return
      }
      router.push(ROLE_ONBOARDING[selected])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <button
            key={role.id}
            data-role={role.id}
            type="button"
            aria-pressed={selected === role.id}
            onClick={() => setSelected(role.id)}
            className={cn(
              'relative rounded-xl border p-4 text-left transition-all',
              selected === role.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-foreground/50'
            )}
          >
            <span className="mb-1 block text-sm font-semibold">{role.title}</span>
            <span className="block text-xs text-muted-foreground">{role.description}</span>
            <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {role.badge}
            </span>
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!selected || loading}
        aria-busy={loading}
        onClick={handleConfirm}
      >
        {loading ? 'Confirming…' : 'Confirm role'}
      </Button>
    </div>
  )
}
